//! EscrowParams — public input to covenant address derivation.
//! Matches the 5 fields of MatchEscrow.sil exactly.

use serde::{Deserialize, Serialize};

/// The 5 public parameters of a MatchEscrow covenant.
/// These are sufficient to deterministically derive the P2SH address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscrowParams {
    /// Hex-encoded HASH160 of player A public key (40 hex chars = 20 bytes)
    pub player_a_hash160: String,
    /// Hex-encoded HASH160 of player B public key (40 hex chars = 20 bytes)
    pub player_b_hash160: String,
    /// Hex-encoded HASH160 of oracle public key (40 hex chars = 20 bytes)
    pub oracle_hash160: String,
    /// Wager amount in sompi (1 KAS = 100_000_000 sompi)
    pub wager_sompi: i64,
    /// DAA score after which refund is claimable
    pub deadline_daa: i64,
    /// Network: "tn12" or "mainnet"
    pub network: String,
}

impl EscrowParams {
    pub fn is_testnet(&self) -> bool {
        self.network == "tn12" || self.network == "testnet"
    }
}
