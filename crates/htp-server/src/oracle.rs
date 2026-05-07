//! oracle.rs — HTP Arbiter attestation module
//!
//! The server acts as HTP_ARBITER: it signs game outcomes so that
//! covenant proposeSettle entrypoints can verify the arbiter's sig
//! on-chain. The server NEVER constructs payout TXs. Covenants do.
//!
//! Settlement paths:
//!   PATH A: both players sign — no arbiter needed
//!   PATH B: HTP_ARBITER + winner sign — opens dispute window
//!   PATH C: HTP_GUARDIAN force-settles after GUARDIAN_WINDOW

use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use secp256k1::{Message, Secp256k1, SecretKey, Keypair};

// --- Request / Response types ---

#[derive(Debug, Deserialize)]
pub struct ProposeSettleReq {
    pub winner:      String,
    pub proof_root:  Option<String>,
    pub settlement_path: Option<String>,  // "A" or "B", defaults to "B"
}

#[derive(Debug, Serialize)]
pub struct ProposeSettleResp {
    pub game_id:          String,
    pub winner:           String,
    pub proof_root:       String,
    pub attestation_hash: String,
    pub arbiter:          String,
    pub settlement_path:  String,
    pub status:           String,
}

#[derive(Debug, Deserialize)]
pub struct ProofCommitReq {
    pub game_id: String,
    pub moves:   Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ProofCommitResp {
    pub game_id:      String,
    pub move_count:   usize,
    pub proof_root:   String,
    pub proof_system: String,
}

#[derive(Debug, Deserialize)]
pub struct AttestPayoutReq {
    pub market_id:   String,
    pub claimer:     String,
    pub amount:      u64,
}

#[derive(Debug, Serialize)]
pub struct AttestPayoutResp {
    pub market_id:        String,
    pub claimer:          String,
    pub amount:           u64,
    pub attestation_hash: String,
    pub arbiter:          String,
    pub status:           String,
}

// --- Core attestation logic ---

pub fn build_attestation(game_id: &str, winner: &str, proof_root: &str) -> String {
    let payload = format!("{}:{}:{}:PROPOSE_SETTLE", game_id, winner, proof_root);
    hex::encode(Sha256::digest(payload.as_bytes()))
}

/// Real secp256k1 Schnorr signing of attestation using ARBITER_PRIVKEY from env.
/// Returns (attestation_hash, schnorr_signature_hex, pubkey_hex)
pub fn signed_attestation(
    game_id: &str,
    winner: &str,
    proof_root: &str,
    path: &str,
) -> Result<(String, String, String), String> {
    let privkey_hex = std::env::var("ARBITER_PRIVKEY")
        .map_err(|_| "ARBITER_PRIVKEY not set in environment".to_string())?;
    
    let payload = format!("{}:{}:{}:{}", game_id, winner, proof_root, path);
    let hash = hex::encode(Sha256::digest(payload.as_bytes()));
    
    // Parse private key
    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_str(&privkey_hex)
        .map_err(|e| format!("Invalid ARBITER_PRIVKEY: {}", e))?;
    let keypair = Keypair::from_secret_key(&secp, &secret_key);
    let (pubkey, _parity) = keypair.x_only_public_key();
    
    // Create message from hash
    let msg_bytes = hex::decode(&hash).map_err(|e| format!("hex decode: {}", e))?;
    let msg = Message::from_digest_slice(&msg_bytes)
        .map_err(|e| format!("message: {}", e))?;
    
    // Sign with Schnorr (BIP340)
    let sig = secp.sign_schnorr(&msg, &keypair);
    let sig_hex = hex::encode(sig.serialize());
    let pubkey_hex = hex::encode(pubkey.serialize());
    
    Ok((hash, sig_hex, pubkey_hex))
}

pub fn build_payout_attestation(market_id: &str, claimer: &str, amount: u64) -> String {
    let mut h = Sha256::new();
    h.update(market_id.as_bytes());
    h.update(b":");
    h.update(claimer.as_bytes());
    h.update(b":");
    h.update(&amount.to_le_bytes());
    hex::encode(h.finalize())
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
