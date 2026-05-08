//! HTP Oracle Node — run alongside kaspad on TN12.
//! Fetches event resolution URL, evaluates condition, signs outcome, submits attestation.
//! Operator earns 0.5 percent of event pool for correct attestations.

use anyhow::{anyhow, Result};
use clap::Parser;
use secp256k1::{Keypair, Message, Secp256k1, SecretKey};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::time::Duration;

#[derive(Parser, Debug)]
#[command(name = "htp-oracle-node")]
struct Cfg {
    #[arg(long, env = "HTP_ORACLE_PRIVKEY")]
    privkey: String,
    #[arg(long, env = "HTP_BACKEND_URL", default_value = "https://hightable.duckdns.org")]
    backend: String,
    #[arg(long, env = "HTP_ORACLE_NAME", default_value = "anon-oracle")]
    name: String,
    #[arg(long, env = "HTP_POLL_INTERVAL", default_value = "15")]
    poll_interval: u64,
    #[arg(long, default_value_t = false)]
    dry_run: bool,
}

fn attestation_hash(event_id: &str, outcome: &str, value: &str, daa: u64) -> String {
    let msg = format!("HTP-v1|{}|{}|{}|{}", event_id, outcome, value, daa);
    hex::encode(Sha256::digest(msg.as_bytes()))
}

fn sign(keypair: &Keypair, hash_hex: &str) -> Result<String> {
    let secp = Secp256k1::new();
    let bytes = hex::decode(hash_hex)?;
    let arr: [u8; 32] = bytes.try_into().map_err(|_| anyhow!("hash must be 32 bytes"))?;
    let msg = Message::from_digest_slice(&arr)?;
    let sig = secp.sign_schnorr(&msg, keypair);
    Ok(hex::encode(sig.as_ref()))
}

async fn fetch_value(client: &reqwest::Client, url: &str, path: &str) -> Result<String> {
    let resp: serde_json::Value = client.get(url)
        .timeout(Duration::from_secs(10))
        .header("User-Agent", "HTP-Oracle-Node/1.0")
        .send().await?.json().await?;
    let keys: Vec<&str> = path.trim_start_matches("$.")
        .trim_start_matches('$').split('.')
        .filter(|s| !s.is_empty()).collect();
    let mut cur = &resp;
    for key in &keys {
        cur = cur.get(key).ok_or_else(|| anyhow!("key not found: {}", key))?;
    }
    Ok(match cur {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        other => other.to_string(),
    })
}

fn evaluate(value: &str, condition: &str) -> Result<String> {
    let parts: Vec<&str> = condition.splitn(2, ':').collect();
    if parts.len() != 2 { return Err(anyhow!("bad condition: {}", condition)); }
    let (op, target) = (parts[0].trim(), parts[1].trim());
    let v = value.trim();
    match op {
        "eq" => Ok(if v.to_lowercase() == target.to_lowercase() { "yes" } else { "no" }.into()),
        "gt" | "gte" | "lt" | "lte" => {
            let n: f64 = v.parse().map_err(|_| anyhow!("not a number: {}", v))?;
            let t: f64 = target.parse().map_err(|_| anyhow!("not a number: {}", target))?;
            let m = match op { "gt"=>n>t, "gte"=>n>=t, "lt"=>n<t, "lte"=>n<=t, _=>false };
            Ok(if m { "yes" } else { "no" }.into())
        }
        "contains" => Ok(if v.to_lowercase().contains(&target.to_lowercase()) { "yes" } else { "no" }.into()),
        "winner_is" => Ok(if v.to_lowercase() == target.to_lowercase() { target.to_string() } else { "other".into() }),
        _ => Err(anyhow!("unknown operator: {}", op)),
    }
}

async fn resolve_event(
    client: &reqwest::Client, cfg: &Cfg, kp: &Keypair, pk_hex: &str, ev: &serde_json::Value,
) -> Result<()> {
    let id = ev["id"].as_str().unwrap_or("?");
    let url = ev["resolution_url"].as_str().unwrap_or("");
    let path = ev["resolution_json_path"].as_str().unwrap_or("$.result");
    let cond = ev["resolution_condition"].as_str().unwrap_or("eq:yes");
    let daa = ev["resolution_daa"].as_u64().unwrap_or(0);

    let value = fetch_value(client, url, path).await?;
    let outcome = evaluate(&value, cond)?;
    let hash = attestation_hash(id, &outcome, &value, daa);
    let sig = sign(kp, &hash)?;

    tracing::info!("[{}] value={} outcome={}", id, value, outcome);

    if cfg.dry_run {
        println!("{}", serde_json::json!({"event_id":id,"value":value,"outcome":outcome,"hash":hash,"sig":sig}));
        return Ok(());
    }

    let payload = serde_json::json!({
        "attestor_pubkey": pk_hex, "attestor_type": "oracle",
        "resolution_value": value, "signed_outcome": outcome,
        "attestation_hash": hash, "signature": sig, "daa_score": daa,
    });

    let submit_url = format!("{}/api/events/{}/attest", cfg.backend.trim_end_matches('/'), id);
    match client.post(&submit_url).json(&payload).send().await {
        Ok(r) if r.status().is_success() => {
            let body: serde_json::Value = r.json().await.unwrap_or_default();
            let cnt = body["matching_attestations"].as_i64().unwrap_or(0);
            let need = body["quorum_required"].as_i64().unwrap_or(0);
            if body["quorum_reached"].as_bool().unwrap_or(false) {
                tracing::info!("[{}] QUORUM REACHED ({}/{}). 0.5 pool fee.", id, cnt, need);
            } else {
                tracing::info!("[{}] attested ({}/{})", id, cnt, need);
            }
        }
        Ok(r) => tracing::warn!("[{}] rejected ({}): {:?}", id, r.status(), r.text().await.ok()),
        Err(e) => tracing::error!("[{}] submit error: {}", id, e),
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt().with_env_filter("info").init();
    let cfg = Cfg::parse();

    let sk = SecretKey::from_slice(&hex::decode(&cfg.privkey)?)?;
    let secp = Secp256k1::new();
    let kp = Keypair::from_secret_key(&secp, &sk);
    let pk_hex = hex::encode(kp.public_key().serialize());

    tracing::info!("HTP Oracle Node | {} | pubkey {}...", cfg.name, &pk_hex[..20]);

    let client = reqwest::Client::builder().timeout(Duration::from_secs(15)).build()?;
    let mut done: HashSet<String> = HashSet::new();

    loop {
        let list_url = format!("{}/api/events", cfg.backend.trim_end_matches('/'));
        match client.get(&list_url).send().await {
            Err(e) => tracing::warn!("backend unreachable: {} — retry in {}s", e, cfg.poll_interval),
            Ok(r) => if let Ok(body) = r.json::<serde_json::Value>().await {
                let events = body["events"].as_array().cloned().unwrap_or_default();
                let new: Vec<_> = events.into_iter()
                    .filter(|e| e["id"].as_str().map(|id| !done.contains(id)).unwrap_or(false))
                    .collect();
                if new.is_empty() {
                    tracing::info!("no new events. waiting {}s...", cfg.poll_interval);
                }
                for ev in new {
                    let id = ev["id"].as_str().unwrap_or("?").to_string();
                    match resolve_event(&client, &cfg, &kp, &pk_hex, &ev).await {
                        Ok(()) => { done.insert(id); }
                        Err(e) => tracing::warn!("event {} failed: {}", id, e),
                    }
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(cfg.poll_interval)).await;
    }
}
