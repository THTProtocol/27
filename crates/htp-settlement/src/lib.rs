//! HTP Settlement Engine — port of lib/settlement.js
//! Handles escrow lock, payout calculation, and idempotency.

use htp_db::Database;
use htp_kaspa_rpc::KaspaRpc;
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use std::sync::Arc;

#[derive(Debug, thiserror::Error)]
pub enum SettleError {
    #[error("DB error: {0}")]
    Db(#[from] htp_db::DbError),
    #[error("RPC error: {0}")]
    Rpc(#[from] htp_kaspa_rpc::RpcError),
    #[error("Game not found: {0}")]
    NotFound(String),
    #[error("Game not complete: {0}")]
    NotComplete(String),
    #[error("Already settled: {0}")]
    AlreadySettled(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettleResult {
    pub game_id: String,
    pub winner: String,
    pub settle_txid: String,
    pub payout_sompi: i64,
    pub fee_sompi: i64,
}

const GAME_FEE_BPS: i64 = 200; // 2%
const TX_FEE_SOMPI: i64 = 30000;

/// Build an idempotency hash: SHA256(game_id + winner + amount)
pub fn settlement_hash(game_id: &str, winner: &str, amount: i64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}:{}", game_id, winner, amount));
    hex::encode(hasher.finalize())
}

/// Calculate winner payout after protocol fee.
pub fn calculate_payout(escrow_amount: i64) -> (i64, i64) {
    let fee = escrow_amount * GAME_FEE_BPS / 10000;
    let payout = escrow_amount - fee - TX_FEE_SOMPI;
    (payout, fee)
}

pub struct SettlementEngine {
    db: Arc<Database>,
    rpc: Arc<KaspaRpc>,
}

impl SettlementEngine {
    pub fn new(db: Arc<Database>, rpc: Arc<KaspaRpc>) -> Self {
        Self { db, rpc }
    }

    /// Check if a settlement has already been processed.
    pub fn is_settled(&self, game_id: &str, winner: &str, amount: i64) -> Result<bool, SettleError> {
        let hash = settlement_hash(game_id, winner, amount);
        Ok(self.db.check_settlement(&hash)?.is_some())
    }

    /// Record a completed settlement.
    pub fn record(&self, game_id: &str, winner: &str, amount: i64, txid: &str) -> Result<(), SettleError> {
        let hash = settlement_hash(game_id, winner, amount);
        self.db.record_settlement(&hash, game_id, txid)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payout_calculation() {
        let (payout, fee) = calculate_payout(1_000_000);
        assert!(payout > 0);
        assert_eq!(fee, 1_000_000 * GAME_FEE_BPS / 10000);
    }

    #[test]
    fn test_settlement_hash_deterministic() {
        let h1 = settlement_hash("g1", "addr1", 1000);
        let h2 = settlement_hash("g1", "addr1", 1000);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_settlement_hash_different() {
        let h1 = settlement_hash("g1", "addr1", 1000);
        let h2 = settlement_hash("g1", "addr2", 1000);
        assert_ne!(h1, h2);
    }
}
