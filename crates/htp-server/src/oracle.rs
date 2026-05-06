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
