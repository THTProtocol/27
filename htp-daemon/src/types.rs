//! Shared types used across the daemon modules.

use serde::{Deserialize, Serialize};

// ── Network ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KaspaNetwork {
    Mainnet,
    Testnet12,
}

impl KaspaNetwork {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "mainnet" => Self::Mainnet,
            _ => Self::Testnet12,
        }
    }

    pub fn rest_url(&self) -> &'static str {
        match self {
            Self::Mainnet => "https://api.kaspa.org",
            Self::Testnet12 => "https://api-tn12.kaspa.org",
        }
    }

    pub fn address_prefix(&self) -> &'static str {
        match self {
            Self::Mainnet => "kaspa",
            Self::Testnet12 => "kaspatest",
        }
    }

    pub fn treasury_address(&self) -> &'static str {
        match self {
            Self::Mainnet =>
                "kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel",
            Self::Testnet12 =>
                "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m",
        }
    }

    pub fn network_id(&self) -> &'static str {
        match self {
            Self::Mainnet => "mainnet",
            Self::Testnet12 => "testnet-12",
        }
    }
}

// ── Fee constants ─────────────────────────────────────────────────────────────

pub const SKILL_GAME_FEE_PCT: f64   = 0.02;  // 2% of total pool
pub const EVENT_WIN_FEE_PCT: f64    = 0.02;  // 2% of net winnings
pub const MAXI_HEDGE_FEE_PCT: f64   = 0.30;  // 30% of hedge on maximizer loss
pub const MAXI_POOL_PCT: f64        = 0.50;  // 50% of maximizer bet to pool
pub const NETWORK_FEE_SOMPI: u64    = 10_000; // 0.0001 KAS minimum TX fee
pub const SOMPI_PER_KAS: u64        = 100_000_000;

pub fn kas_to_sompi(kas: f64) -> u64 {
    (kas * SOMPI_PER_KAS as f64).round() as u64
}
pub fn sompi_to_kas(sompi: u64) -> f64 {
    sompi as f64 / SOMPI_PER_KAS as f64
}

// ── Firebase data shapes ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchData {
    pub match_id:    Option<String>,
    pub status:      Option<String>,
    pub winner:      Option<String>,  // "playerA" | "playerB" | "draw" | "timeout"
    pub player_a:    Option<String>,  // wallet address
    pub player_b:    Option<String>,  // wallet address
    pub stake_kas:   Option<f64>,
    pub escrow_address: Option<String>,
    pub deadline_daa:   Option<String>, // BigInt as string
    pub settlement_at:  Option<i64>,
    pub settle_tx_id:   Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EscrowData {
    pub address:           String,
    pub redeem_script:     Option<String>,
    pub escrow_pubkey_hex: Option<String>,
    pub fee_spk_hex:       Option<String>,
    pub network:           Option<String>,
    pub covenant:          Option<bool>,
    pub version:           Option<u32>,
    // NOTE: privateKey is NEVER in Firebase. Daemon holds it locally.
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementRecord {
    pub match_id:        String,
    #[serde(rename = "type")]
    pub record_type:     String,
    pub winner:          String,
    pub winner_address:  String,
    pub stake_kas:       f64,
    pub total_pool:      f64,
    pub protocol_fee:    f64,
    pub winner_payout:   f64,
    pub treasury_address: String,
    pub network_id:      String,
    pub status:          String,  // "pending_tx" | "submitted" | "confirmed" | "failed"
    pub settle_tx_id:    Option<String>,
    pub settled_at:      i64,
    pub settled_by:      String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleAttestation {
    pub event_id: String,
    pub outcome:  String,
    pub oracle:   String,
    pub sig:      String,
    pub hash:     String,
    pub ts:       i64,
    pub source:   Option<String>,
}

// ── REST API types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UtxoEntry {
    pub outpoint: Outpoint,
    #[serde(rename = "utxoEntry")]
    pub utxo_entry: UtxoEntryInner,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Outpoint {
    #[serde(rename = "transactionId")]
    pub transaction_id: String,
    pub index: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct UtxoEntryInner {
    pub amount: String,          // sompi as string
    #[serde(rename = "scriptPublicKey")]
    pub script_public_key: ScriptPublicKey,
    #[serde(rename = "blockDaaScore")]
    pub block_daa_score: String,
    #[serde(rename = "isCoinbase")]
    pub is_coinbase: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ScriptPublicKey {
    pub version: u32,
    #[serde(rename = "scriptPublicKey")]
    pub script: String,  // hex
}

#[derive(Debug, Deserialize)]
pub struct DagInfoResponse {
    #[serde(rename = "virtualDaaScore")]
    pub virtual_daa_score: Option<String>,
    #[serde(rename = "daaScore")]
    pub daa_score: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTxResponse {
    #[serde(rename = "transactionId")]
    pub transaction_id: Option<String>,
}
