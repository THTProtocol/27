//! Settlement engine — computes payouts and executes on-chain TX.
//!
//! Flow:
//!   1. Firebase watcher fires when matches/{id}/status == "completed"
//!   2. settlement::settle_skill_game() computes amounts via fee rules
//!   3. kaspa::fetch_utxos() gets escrow UTXOs
//!   4. kaspa::build_settlement_tx() builds the signed TX
//!   5. kaspa::submit_tx() submits it to the network
//!   6. Firebase is updated with txId, status = "settled"

use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{error, info, warn};

use crate::firebase::FirebaseClient;
use crate::kaspa;
use crate::types::*;

// ── Settlement lock (in-process double-settle guard) ──────────────────────────

#[derive(Default)]
pub struct SettlementLock {
    active: Mutex<HashMap<String, i64>>,
}

impl SettlementLock {
    pub fn acquire(&self, id: &str) -> bool {
        let mut map = self.active.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        if let Some(&ts) = map.get(id) {
            if now - ts < 60_000 { return false; } // locked for < 60s
        }
        map.insert(id.to_string(), now);
        true
    }
    pub fn release(&self, id: &str) {
        self.active.lock().unwrap().remove(id);
    }
}

// ── Fee computation (mirrors htp-fee-engine.js exactly) ───────────────────────

pub struct SkillGameSettlement {
    pub total_pool_kas:    f64,
    pub protocol_fee_kas:  f64,
    pub winner_payout_kas: f64,
    pub protocol_fee_sompi:  u64,
    pub winner_payout_sompi: u64,
}

pub fn calc_skill_game(stake_kas: f64) -> SkillGameSettlement {
    let total        = stake_kas * 2.0;
    let fee          = total * SKILL_GAME_FEE_PCT;
    let payout       = total - fee;
    SkillGameSettlement {
        total_pool_kas:      total,
        protocol_fee_kas:    fee,
        winner_payout_kas:   payout,
        protocol_fee_sompi:  kas_to_sompi(fee),
        winner_payout_sompi: kas_to_sompi(payout),
    }
}

// ── Escrow private key store ───────────────────────────────────────────────────
//
// The daemon holds escrow private keys in memory only (loaded from a local
// key file at startup). Keys are NEVER stored in Firebase.
//
// Key file format: JSON object { "matchId": "privKeyHex", ... }
// Path: set via ESCROW_KEYS_PATH in .env (default: ./escrow-keys.json)

pub type EscrowKeyStore = Arc<Mutex<HashMap<String, String>>>;

pub fn load_escrow_keys(path: &str) -> EscrowKeyStore {
    let store: HashMap<String, String> = std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    info!("Loaded {} escrow keys from {}", store.len(), path);
    Arc::new(Mutex::new(store))
}

pub fn get_escrow_key(store: &EscrowKeyStore, match_id: &str) -> Option<String> {
    store.lock().unwrap().get(match_id).cloned()
}

pub fn save_escrow_key(store: &EscrowKeyStore, path: &str, match_id: &str, priv_hex: &str) {
    let mut map = store.lock().unwrap();
    map.insert(match_id.to_string(), priv_hex.to_string());
    let _ = std::fs::write(path, serde_json::to_string_pretty(&*map).unwrap_or_default());
}

// ── Skill game settlement ──────────────────────────────────────────────────────

pub async fn settle_skill_game(
    match_id:   &str,
    match_data: &Value,
    fb:         &FirebaseClient,
    http:       &reqwest::Client,
    rest_url:   &str,
    network:    &KaspaNetwork,
    lock:       &SettlementLock,
    key_store:  &EscrowKeyStore,
) -> Result<()> {
    if !lock.acquire(match_id) {
        warn!("Settlement lock active for {}", match_id);
        return Ok(());
    }

    let result = _settle_skill_game_inner(
        match_id, match_data, fb, http, rest_url, network, key_store
    ).await;

    lock.release(match_id);

    if let Err(ref e) = result {
        error!("Settlement failed for {}: {}", match_id, e);
        let _ = fb.update(&format!("matches/{}/info", match_id), &json!({
            "status": "settlement_failed",
            "settlementError": e.to_string()
        })).await;
    }

    result
}

async fn _settle_skill_game_inner(
    match_id:   &str,
    match_data: &Value,
    fb:         &FirebaseClient,
    http:       &reqwest::Client,
    rest_url:   &str,
    network:    &KaspaNetwork,
    key_store:  &EscrowKeyStore,
) -> Result<()> {
    // Check if already settled
    if let Ok(Some(existing)) = fb.get(&format!("settlement/{}/claimed", match_id)).await {
        if existing.get("txId").is_some() {
            info!("Match {} already settled", match_id);
            return Ok(());
        }
    }

    let info     = &match_data["info"];
    let winner   = info["winner"].as_str().ok_or_else(|| anyhow!("No winner"))?;
    let stake_kas = info["stakeKas"].as_f64().ok_or_else(|| anyhow!("No stakeKas"))?;
    let player_a = info["creatorAddress"].as_str().ok_or_else(|| anyhow!("No creatorAddress"))?;
    let player_b = info["joinerAddress"].as_str().ok_or_else(|| anyhow!("No joinerAddress"))?;

    let winner_addr = match winner {
        "draw" => None,
        "playerA" | "creator" => Some(player_a),
        "playerB" | "joiner"  => Some(player_b),
        _ => return Err(anyhow!("Unknown winner value: {}", winner)),
    };

    // Get escrow data from Firebase (public fields only)
    let escrow_fb = fb.get(&format!("escrows/{}", match_id)).await?
        .ok_or_else(|| anyhow!("No escrow record for {}", match_id))?;
    let escrow_address = escrow_fb["address"].as_str()
        .ok_or_else(|| anyhow!("No escrow address"))?.to_string();
    let redeem_script = escrow_fb["redeemScript"].as_str().unwrap_or("").to_string();

    // Get private key from local key store (NOT from Firebase)
    let priv_hex = get_escrow_key(key_store, match_id)
        .ok_or_else(|| anyhow!("No escrow private key for {} — daemon must hold the key", match_id))?;

    // Fetch UTXOs
    let utxos = kaspa::fetch_utxos(http, rest_url, &escrow_address).await?;
    if utxos.is_empty() {
        return Err(anyhow!("Escrow address {} has no UTXOs", &escrow_address[..24]));
    }
    let total_sompi = kaspa::sum_utxos(&utxos);
    info!("Escrow {} has {} UTXOs = {} sompi", match_id, utxos.len(), total_sompi);

    // Build outputs
    let outputs: Vec<(String, u64)> = if winner == "draw" {
        let half = (total_sompi - NETWORK_FEE_SOMPI) / 2;
        vec![
            (player_a.to_string(), half),
            (player_b.to_string(), half),
        ]
    } else {
        let calc         = calc_skill_game(stake_kas);
        let fee_sompi    = calc.protocol_fee_sompi.max(1000); // min 0.00001 KAS
        let payout_sompi = total_sompi
            .checked_sub(fee_sompi + NETWORK_FEE_SOMPI)
            .ok_or_else(|| anyhow!("Pool too small for fee"))?;
        vec![
            (winner_addr.unwrap().to_string(), payout_sompi),
            (network.treasury_address().to_string(), fee_sompi),
        ]
    };

    info!("Settlement outputs for {}: {:?}", match_id, outputs);

    // Acquire settlement lock in Firebase
    fb.set(&format!("settlement/{}/claimed", match_id), &json!({
        "by":  "htp-daemon",
        "ts":  chrono::Utc::now().timestamp_millis()
    })).await?;

    // Build + sign + submit TX
    let tx = kaspa::build_settlement_tx(
        &utxos, &escrow_address, &outputs, &priv_hex, &redeem_script, "settle"
    )?;

    let tx_id = match kaspa::submit_tx(http, rest_url, &tx).await {
        Ok(id) => id,
        Err(e) => {
            // Release Firebase lock on failure
            let _ = fb.delete(&format!("settlement/{}/claimed", match_id)).await;
            return Err(e);
        }
    };

    // Write result back to Firebase
    fb.update(&format!("settlement/{}/claimed", match_id), &json!({
        "txId":       tx_id,
        "settledAt":  chrono::Utc::now().timestamp_millis()
    })).await?;
    fb.update(&format!("matches/{}/info", match_id), &json!({
        "status":      "settled",
        "settleTxId":  tx_id,
        "settledAt":   chrono::Utc::now().timestamp_millis()
    })).await?;

    info!("Match {} settled: txId={}", match_id, tx_id);
    Ok(())
}
