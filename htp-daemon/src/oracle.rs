//! Oracle attestation engine.
//!
//! Responsibilities:
//!   - Poll Firebase /events for resolved events needing on-chain settlement
//!   - Poll external APIs (CoinGecko, OpenLigaDB, Kaspa DAA) for event results
//!   - Sign attestations with the oracle private key (secp256k1 HMAC-SHA256)
//!   - Write attestations to Firebase /attestations/{eventId}/{oracleAddr}
//!   - When threshold is reached, mark event as resolved

use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tracing::{error, info, warn};

use crate::firebase::FirebaseClient;
use crate::kaspa::fetch_daa_score;
use crate::types::KaspaNetwork;

// ── Oracle identity ────────────────────────────────────────────────────────────

pub struct Oracle {
    pub address:   String,  // e.g. "kaspatest:oracle-<pubhash>"
    priv_key_hex:  String,  // 32-byte hex, never leaves this struct
    threshold:     u32,
    network:       KaspaNetwork,
}

impl Oracle {
    pub fn new(priv_key_hex: String, network: KaspaNetwork, threshold: u32) -> Self {
        // Derive a stable oracle address from the key
        let key_bytes = hex::decode(priv_key_hex.trim()).unwrap_or_default();
        let hash: [u8; 32] = Sha256::digest(&key_bytes).into();
        let short_id = hex::encode(&hash[..10]);
        let address  = format!("{}:oracle-{}", network.address_prefix(), short_id);
        Self { address, priv_key_hex, threshold, network }
    }

    /// Sign an attestation payload with HMAC-SHA256.
    /// Returns (payload_hash_hex, signature_hex).
    pub fn sign(&self, event_id: &str, outcome: &str, ts: i64) -> (String, String) {
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;

        let payload = format!(
            "{{\"eventId\":\"{}\",\"outcome\":\"{}\",\"oracle\":\"{}\",\"ts:{}}}",
            event_id, outcome, self.address, ts
        );
        let payload_hash: [u8; 32] = Sha256::digest(payload.as_bytes()).into();
        let payload_hash_hex = hex::encode(payload_hash);

        let key_bytes = hex::decode(self.priv_key_hex.trim()).unwrap_or_default();
        let mut mac = HmacSha256::new_from_slice(&key_bytes)
            .expect("HMAC key length error");
        mac.update(&payload_hash);
        let sig_hex = hex::encode(mac.finalize().into_bytes());

        (payload_hash_hex, sig_hex)
    }
}

// ── Event result resolvers ─────────────────────────────────────────────────────

pub async fn resolve_event(
    event:    &Value,
    http:     &Client,
    rest_url: &str,
) -> Option<String>  // returns outcome string or None
{
    let source = event["source"].as_str()?;
    if !source.starts_with("api:") { return None; }

    let parts: Vec<&str> = source.split(':').collect();
    match parts.get(1).copied() {
        Some("kaspa") if parts.get(2) == Some(&"daa") => {
            resolve_kaspa_daa(parts.get(3).copied()?, http, rest_url).await
        }
        Some("coingecko") => {
            let coin_id = parts.get(2).copied()?;
            let cond    = parts.get(3).copied()?;
            resolve_coingecko(coin_id, cond, http).await
        }
        Some("openligadb") => {
            let league   = parts.get(2).copied()?;
            let matchday = parts.get(3).copied()?;
            let season   = parts.get(4).copied().unwrap_or("2025");
            let outcomes = event["outcomes"].as_array().cloned().unwrap_or_default();
            resolve_openligadb(league, matchday, season, &outcomes, http).await
        }
        Some("manual") => None,
        _ => {
            warn!("No resolver for source: {}", source);
            None
        }
    }
}

async fn resolve_kaspa_daa(threshold_str: &str, http: &Client, rest_url: &str) -> Option<String> {
    let threshold: u64 = threshold_str.parse().ok()?;
    let score = fetch_daa_score(http, rest_url).await.ok()?;
    if score >= threshold { Some("Yes".to_string()) } else { None }
}

async fn resolve_coingecko(coin_id: &str, cond: &str, http: &Client) -> Option<String> {
    // cond format: "kaspa>0.15" or "bitcoin<30000"
    let op    = if cond.contains('>') { '>' } else { '<' };
    let split: Vec<&str> = cond.splitn(2, op).collect();
    let target: f64 = split.get(1)?.parse().ok()?;

    let url = format!(
        "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies=usd",
        coin_id
    );
    let resp: Value = http.get(&url).send().await.ok()?.json().await.ok()?;
    let price = resp[coin_id]["usd"].as_f64()?;

    let yes = if op == '>' { price > target } else { price < target };
    Some(if yes { "Yes" } else { "No" }.to_string())
}

async fn resolve_openligadb(
    league:   &str,
    matchday: &str,
    season:   &str,
    outcomes: &[Value],
    http:     &Client,
) -> Option<String> {
    let url = format!(
        "https://api.openligadb.de/getmatchdata/{}/{}/{}",
        league, season, matchday
    );
    let matches: Vec<Value> = http.get(&url).send().await.ok()?.json().await.ok()?;
    let all_finished = matches.iter().all(|m| m["MatchIsFinished"].as_bool().unwrap_or(false));
    if !all_finished { return None; }

    let m      = matches.first()?;
    let result = m["MatchResults"].as_array()?.iter()
        .find(|r| r["ResultTypeID"].as_u64() == Some(2))?;
    let s1 = result["PointsTeam1"].as_u64()?;
    let s2 = result["PointsTeam2"].as_u64()?;

    if outcomes.len() >= 3 {
        let idx = if s1 > s2 { 0 } else if s2 > s1 { 2 } else { 1 };
        Some(outcomes[idx].as_str()?.to_string())
    } else {
        Some(if s1 > s2 { "Home Win" } else if s2 > s1 { "Away Win" } else { "Draw" }.to_string())
    }
}

// ── Core attestation ──────────────────────────────────────────────────────────

pub async fn attest_event(
    oracle:   &Oracle,
    event_id: &str,
    outcome:  &str,
    source:   &str,
    fb:       &FirebaseClient,
    threshold: u32,
) -> Result<bool>  // returns true if threshold reached and event finalised
{
    let safe_addr = oracle.address.replace('.', "_").replace('#', "_");

    // Check for duplicate attestation
    let existing = fb.get(&format!("attestations/{}/{}", event_id, safe_addr)).await?;
    if let Some(ref v) = existing {
        if v["outcome"].as_str() == Some(outcome) {
            return Ok(false); // already attested with same outcome
        }
    }

    let ts = chrono::Utc::now().timestamp_millis();
    let (hash, sig) = oracle.sign(event_id, outcome, ts);

    fb.set(&format!("attestations/{}/{}", event_id, safe_addr), &json!({
        "outcome": outcome,
        "sig":     sig,
        "hash":    hash,
        "oracle":  oracle.address,
        "ts":      ts,
        "source":  source,
    })).await?;

    info!("Attested {} → \"{}\" (sig: {}...)", event_id, outcome, &hash[..16]);

    // Check threshold
    let all_atts = fb.get(&format!("attestations/{}", event_id)).await?
        .unwrap_or(Value::Object(Default::default()));

    let mut votes: std::collections::HashMap<String, u32> = Default::default();
    if let Some(obj) = all_atts.as_object() {
        for att in obj.values() {
            if let Some(o) = att["outcome"].as_str() {
                *votes.entry(o.to_string()).or_default() += 1;
            }
        }
    }

    if let Some((final_outcome, count)) = votes.iter().find(|(_, c)| **c >= threshold) {
        info!("Threshold reached for {} → \"{}\" ({}/{})",
            event_id, final_outcome, count, threshold);
        fb.update(&format!("events/{}", event_id), &json!({
            "status":   "resolved",
            "outcome":  final_outcome,
            "resolution": {
                "outcome": final_outcome,
                "method":  "htp-daemon",
                "oracle":  oracle.address,
                "ts":      ts,
                "votes":   votes,
            }
        })).await?;
        return Ok(true);
    }

    Ok(false)
}
