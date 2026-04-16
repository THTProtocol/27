use serde::{Deserialize, Serialize};

// ============================================================
// Core
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub network: String,
}

// --- Wallet ---
#[derive(Debug, Deserialize)]
pub struct MnemonicRequest { pub mnemonic: String, pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct WalletResponse { pub address: String, pub public_key: String }

#[derive(Debug, Serialize)]
pub struct BalanceResponse { pub balance: u64, pub balance_kas: String, pub utxo_count: u64 }

// --- Escrow ---
#[derive(Debug, Deserialize)]
pub struct EscrowCreateRequest { pub pubkey_a: String, pub pubkey_b: String, pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct EscrowCreateResponse { pub escrow_address: String, pub script_hash: String }

#[derive(Debug, Deserialize)]
pub struct EscrowPayoutRequest {
    pub escrow_address: String, pub winner_address: String,
    pub treasury_address: String, pub fee_bps: u32, pub utxos: Vec<UtxoRef>,
}

#[derive(Debug, Deserialize)]
pub struct EscrowCancelRequest {
    pub escrow_address: String, pub player_a_address: String,
    pub player_b_address: String, pub utxos: Vec<UtxoRef>,
}

#[derive(Debug, Serialize)]
pub struct TxResponse { pub raw_tx: String, pub tx_id: String }

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UtxoRef { pub tx_id: String, pub index: u32, pub amount: u64 }

// --- BlockDAG ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlockHeader { pub hash: String, pub timestamp: u64, pub parent_hashes: Vec<String>, pub blue_score: Option<u64> }

#[derive(Debug, Serialize)]
pub struct BlockDAGResponse { pub blocks: Vec<BlockHeader> }

// --- Broadcast ---
#[derive(Debug, Deserialize)]
pub struct BroadcastRequest { pub raw_tx: String }

#[derive(Debug, Serialize)]
pub struct BroadcastResponse { pub tx_id: String }

// --- Kaspa REST ---
#[derive(Debug, Deserialize)]
pub struct KaspaBalanceResponse { pub address: Option<String>, pub balance: Option<u64> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaspaBlockDagInfo {
    pub block_count: Option<u64>, pub header_count: Option<u64>,
    pub tip_hashes: Option<Vec<String>>, pub difficulty: Option<f64>,
    pub past_median_time: Option<u64>, pub virtual_parent_hashes: Option<Vec<String>>,
    pub pruning_point_hash: Option<String>, pub virtual_daa_score: Option<u64>,
    pub hashrate: Option<f64>, pub block_rate: Option<f64>,
}

// ============================================================
// Fee Engine  (fee.rs)
// ============================================================
#[derive(Debug, Deserialize)]
pub struct FeeSkillSettleRequest { pub stake_kas: f64, pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct FeeSkillSettleResponse {
    pub total_pool: f64, pub protocol_fee: f64, pub winner_payout: f64,
    pub protocol_fee_sompi: u64, pub winner_payout_sompi: u64,
    pub fee_breakdown: String, pub treasury_address: String,
}

#[derive(Debug, Serialize)]
pub struct CancelCheckResponse { pub allowed: bool, pub reason: String }

#[derive(Debug, Deserialize)]
pub struct CancelCheckRequest { pub game_status: String, pub opponent_joined: bool }

#[derive(Debug, Serialize)]
pub struct MaximizerSplitResponse { pub pool_contribution: f64, pub hedge_amount: f64, pub effective_pool_bet: f64 }

#[derive(Debug, Deserialize)]
pub struct MaximizerWinRequest { pub bet_kas: f64, pub odds: f64, pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct MaximizerWinResponse {
    pub gross_payout: f64, pub protocol_fee: f64, pub net_payout: f64,
    pub hedge_returned: f64, pub total_received: f64,
    pub fee_breakdown: String, pub treasury_address: String,
}

#[derive(Debug, Deserialize)]
pub struct MaximizerLoseRequest { pub bet_kas: f64, pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct MaximizerLoseResponse {
    pub pool_lost: f64, pub hedge_fee: f64, pub hedge_recovered: f64,
    pub net_loss: f64, pub fee_breakdown: String, pub treasury_address: String,
}

#[derive(Debug, Deserialize)]
pub struct TreasuryRequest { pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct TreasuryResponse { pub treasury_address: String, pub network: String }

// ============================================================
// Settlement  (settlement.rs)
// ============================================================
#[derive(Debug, Deserialize)]
pub struct SettlementPreviewRequest {
    pub stake_kas: f64, pub winner_address: Option<String>,
    pub player_a_address: Option<String>, pub player_b_address: Option<String>,
    pub is_draw: Option<bool>, pub network: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SettlementPreviewResponse {
    pub stake_kas: f64, pub total_pool: f64,
    pub winner_amount: f64, pub player_a_amount: f64, pub player_b_amount: f64,
    pub protocol_fee: f64, pub protocol_fee_sompi: u64, pub winner_payout_sompi: u64,
    pub treasury_address: String, pub fee_breakdown: String, pub is_draw: bool, pub network: String,
}

#[derive(Debug, Deserialize)]
pub struct CovenantValidateRequest { pub redeem_script_hex: String, pub network: Option<String> }

#[derive(Debug, Serialize)]
pub struct CovenantValidateResponse { pub valid: bool, pub expected_treasury: String, pub found_in_script: bool, pub error: Option<String> }

// ============================================================
// Deadline  (deadline.rs)
// ============================================================
#[derive(Debug, Deserialize)]
pub struct DeadlineCreateRequest { pub current_daa: u64, pub seconds: Option<f64>, pub daa_score: Option<u64>, pub label: Option<String> }

#[derive(Debug, Serialize)]
pub struct DeadlineCreateResponse { pub deadline_daa: u64, pub current_daa: u64, pub remaining_daa: u64, pub remaining_secs: f64, pub label: String, pub expired: bool }

#[derive(Debug, Deserialize)]
pub struct DeadlineCheckRequest { pub current_daa: u64, pub deadline_daa: u64 }

#[derive(Debug, Serialize)]
pub struct DeadlineCheckResponse { pub expired: bool, pub remaining_daa: u64, pub remaining_secs: f64, pub current_daa: u64, pub deadline_daa: u64 }

#[derive(Debug, Serialize)]
pub struct DaaResponse { pub virtual_daa_score: u64 }

// ============================================================
// Oracle Commit  (oracle_commit.rs)
// ============================================================
#[derive(Debug, Deserialize)]
pub struct OracleCommitRequest {
    pub market_id: String, pub oracle_addr: String, pub outcome: String,
    pub evidence_url: String, pub submitted_at: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct OracleCommitResponse {
    pub market_id: String, pub oracle_addr: String, pub outcome: String,
    pub evidence_url: String, pub commit_hash: String, pub proof_system: String,
    pub zk_tag: Option<u8>, pub toccata_ready: bool,
    pub submitted_at: u64, pub dispute_ends_at: u64, pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct AutoAttestRequest {
    pub market_id: String, pub oracle_addr: String,
    pub outcomes: Vec<String>, pub api_url: String, pub api_path: Option<String>,
}

// ============================================================
// Markets  (markets.rs)
// ============================================================
#[derive(Debug, Deserialize)]
pub struct MarketCreateRequest {
    pub title: String, pub description: String, pub outcomes: Vec<String>,
    pub resolution_date: u64, pub source_url: Option<String>,
    pub min_position: Option<f64>, pub max_participants: Option<u32>,
    pub creator_address: String,
}

#[derive(Debug, Serialize)]
pub struct MarketCreateResponse {
    pub market_id: String, pub title: String, pub description: String,
    pub outcomes: Vec<String>, pub resolution_date: u64, pub source_url: Option<String>,
    pub min_position: f64, pub max_participants: Option<u32>,
    pub creator_address: String, pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct BetPlaceRequest {
    pub market_id: String, pub player_address: String,
    pub outcome_index: usize, pub amount_kas: f64,
}

#[derive(Debug, Serialize)]
pub struct BetPlaceResponse {
    pub position_id: String, pub market_id: String, pub player_address: String,
    pub outcome_index: usize, pub amount_kas: f64, pub amount_sompi: u64, pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct OddsRequest { pub position_totals: Vec<f64> }

#[derive(Debug, Serialize)]
pub struct OddsResponse { pub odds_pct: Vec<f64>, pub total_pool_kas: f64, pub implied_multipliers: Vec<f64> }

// ============================================================
// Auto-Payout  (autopayout.rs)
// ============================================================
#[derive(Debug, Deserialize, Clone)]
pub struct WinnerRaw { pub value: String }

#[derive(Debug, Deserialize)]
pub struct ResolveWinnerRequest {
    pub match_id: String, pub game: String, pub winner_raw: String, pub reason: String,
    pub creator_address: Option<String>, pub joiner_address: Option<String>,
    pub creator_player_id: Option<String>, pub joiner_player_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ResolveWinnerResponse {
    pub match_id: String, pub winner_str: String, pub winner_address: Option<String>,
    pub is_draw: bool, pub creator_address: Option<String>, pub joiner_address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PrepareSettlementRequest {
    pub match_id: String, pub game: String, pub winner_raw: String, pub reason: String,
    pub stake_kas: f64, pub creator_address: Option<String>, pub joiner_address: Option<String>,
    pub creator_player_id: Option<String>, pub joiner_player_id: Option<String>,
    pub redeem_script_hex: Option<String>, pub network: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PrepareSettlementResponse {
    pub match_id: String, pub is_draw: bool,
    pub winner_address: Option<String>, pub creator_address: Option<String>, pub joiner_address: Option<String>,
    pub winner_str: String, pub stake_kas: f64, pub total_pool: f64,
    pub winner_payout_sompi: u64, pub protocol_fee_sompi: u64,
    pub treasury_address: String, pub fee_breakdown: String,
    pub covenant_ok: bool, pub network: String,
}
