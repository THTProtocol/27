//! HTP Oracle Network — core logic
//! Oracle (auto node), Arbiter (human), Challenger, Proof (ZK)

use sha2::{Digest, Sha256};

// ── Constants ──────────────────────────────────────────
pub const PROTOCOL_FEE_BPS: u64 = 200;
pub const MIN_ORACLE_BOND_SOMPI: u64 = 100_000_000_000;
pub const MIN_ARBITER_BOND_SOMPI: u64 = 50_000_000_000;
pub const MIN_CHALLENGE_STAKE_SOMPI: u64 = 10_000_000_000;

/// Canonical attestation hash. Format: SHA256("HTP-v1|{event_id}|{outcome}|{value}|{daa}")
pub fn attestation_hash(event_id: &str, outcome: &str, value: &str, daa: u64) -> String {
    let msg = format!("HTP-v1|{}|{}|{}|{}", event_id, outcome, value, daa);
    hex::encode(Sha256::digest(msg.as_bytes()))
}

/// Returns (fee_sompi, net_sompi)
pub fn compute_fee(gross: u64, bps: u64) -> (u64, u64) {
    let fee = (gross * bps) / 10_000;
    (fee, gross.saturating_sub(fee))
}

/// Evaluate condition string. Returns (condition_met, outcome_label)
/// Supported: gt:N, lt:N, gte:N, lte:N, eq:STRING, contains:STRING, winner_is:NAME
pub fn evaluate_condition(raw_value: &str, condition: &str) -> Result<(bool, String), String> {
    let parts: Vec<&str> = condition.splitn(2, ':').collect();
    if parts.len() != 2 { return Err(format!("invalid condition: {}", condition)); }
    let (op, target) = (parts[0].trim(), parts[1].trim());
    let v = raw_value.trim();
    match op {
        "eq" => { let m = v.to_lowercase() == target.to_lowercase(); Ok((m, if m {"yes"} else {"no"}.into())) }
        "gt" => {
            let n: f64 = v.parse().map_err(|_| format!("not a number: {}", v))?;
            let t: f64 = target.parse().map_err(|_| format!("not a number: {}", target))?;
            let m = n > t; Ok((m, if m {"yes"} else {"no"}.into()))
        }
        "gte" => {
            let n: f64 = v.parse().map_err(|_| format!("not a number: {}", v))?;
            let t: f64 = target.parse().map_err(|_| format!("not a number: {}", target))?;
            let m = n >= t; Ok((m, if m {"yes"} else {"no"}.into()))
        }
        "lt" => {
            let n: f64 = v.parse().map_err(|_| format!("not a number: {}", v))?;
            let t: f64 = target.parse().map_err(|_| format!("not a number: {}", target))?;
            let m = n < t; Ok((m, if m {"yes"} else {"no"}.into()))
        }
        "lte" => {
            let n: f64 = v.parse().map_err(|_| format!("not a number: {}", v))?;
            let t: f64 = target.parse().map_err(|_| format!("not a number: {}", target))?;
            let m = n <= t; Ok((m, if m {"yes"} else {"no"}.into()))
        }
        "contains" => { let m = v.to_lowercase().contains(&target.to_lowercase()); Ok((m, if m {"yes"} else {"no"}.into())) }
        "winner_is" => { let m = v.to_lowercase() == target.to_lowercase(); Ok((m, if m {target.to_string()} else {"other".into()})) }
        other => Err(format!("unknown operator: {}", other))
    }
}

// ═══════════════════════════════════════════════════════
// Backward-compatibility for existing routes.rs
// These wrap the new API so old code compiles unchanged
// ═══════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ProposeSettleReq {
    pub winner: String,
    pub proof_root: Option<String>,
    pub settlement_path: Option<String>,
}

/// Thin wrapper calling new attestation_hash
pub fn build_attestation(game_id: &str, winner: &str, proof_root: &str) -> String {
    attestation_hash(game_id, winner, proof_root, 0)
}

/// Signed attestation using secp256k1 (kept from old oracle.rs)
pub fn signed_attestation(
    game_id: &str, winner: &str, proof_root: &str, path: &str,
) -> Result<(String, String, String), String> {
    use secp256k1::{Message, Secp256k1, SecretKey, Keypair};
    use std::str::FromStr;

    let privkey_hex = std::env::var("HTP_ORACLE_PRIVKEY")
        .or_else(|_| std::env::var("ARBITER_PRIVKEY"))
        .map_err(|_| "HTP_ORACLE_PRIVKEY not set".to_string())?;

    let payload = format!("{}:{}:{}:{}", game_id, winner, proof_root, path);
    let hash = hex::encode(Sha256::digest(payload.as_bytes()));

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_str(&privkey_hex)
        .map_err(|e| format!("invalid key: {}", e))?;
    let keypair = Keypair::from_secret_key(&secp, &secret_key);
    let (pubkey, _parity) = keypair.x_only_public_key();

    let msg_bytes = hex::decode(&hash).map_err(|e| format!("hex: {}", e))?;
    let msg = Message::from_digest_slice(&msg_bytes)
        .map_err(|e| format!("msg: {}", e))?;

    let sig = secp.sign_schnorr(&msg, &keypair);
    let sig_hex = hex::encode(sig.serialize());
    let pubkey_hex = hex::encode(pubkey.serialize());

    Ok((hash, sig_hex, pubkey_hex))
}

#[derive(Debug, Deserialize)]
pub struct AttestPayoutReq {
    pub market_id: String,
    pub claimer: String,
    pub amount: u64,
}

pub fn build_payout_attestation(market_id: &str, claimer: &str, amount: u64) -> String {
    attestation_hash(market_id, "payout", claimer, amount)
}

#[derive(Debug, Deserialize)]
pub struct ProofCommitReq {
    pub game_id: String,
    pub moves: Vec<String>,
}

pub fn build_proof_root(moves: &[String]) -> Option<String> {
    if moves.is_empty() { return None; }
    let mut latest: Vec<u8> = Sha256::digest(moves[0].as_bytes()).to_vec();
    for mv in &moves[1..] {
        let mut h = Sha256::new();
        h.update(&latest);
        h.update(mv.as_bytes());
        latest = h.finalize().to_vec();
    }
    Some(hex::encode(&latest))
}
