//! types.rs — Shared request/response types for HTP Rust backend

use serde::{Deserialize, Serialize};

// ── Health ─────────────────────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct HealthResponse {
    pub status:  String,
    pub version: String,
    pub network: String,
}

// ── Wallet ─────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct MnemonicRequest {
    pub mnemonic: String,
    pub account:  Option<u32>,
    pub index:    Option<u32>,
    pub network:  Option<String>,
}

#[derive(Serialize)]
pub struct WalletResponse {
    pub address:     String,
    pub public_key:  String,
    pub private_key: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Utxo {
    pub tx_id:  String,
    pub index:  u32,
    pub amount: u64,
}

#[derive(Serialize)]
pub struct BalanceResponse {
    pub address: String,
    pub balance: u64,
    pub utxos:   Vec<Utxo>,
}

// ── Escrow ─────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct EscrowCreateRequest {
    pub pubkey_a: String,
    pub pubkey_b: String,
    pub network:  Option<String>,
}

#[derive(Serialize)]
pub struct EscrowCreateResponse {
    pub escrow_address:    String,
    pub script_hash:       String,
    pub redeem_script_hex: String,
}

#[derive(Deserialize)]
pub struct EscrowPayoutRequest {
    pub escrow_address:    String,
    pub winner_address:    String,
    pub treasury_address:  String,
    pub fee_bps:           u64,
    pub utxos:             Vec<Utxo>,
    pub signing_key_hex:   Option<String>,
    pub redeem_script_hex: Option<String>,
}

#[derive(Deserialize)]
pub struct EscrowCancelRequest {
    pub escrow_address:    String,
    pub player_a_address:  String,
    pub player_b_address:  String,
    pub utxos:             Vec<Utxo>,
    pub signing_key_hex:   Option<String>,
    pub redeem_script_hex: Option<String>,
    pub network:           Option<String>,
}

#[derive(Serialize)]
pub struct TxResponse {
    pub raw_tx: String,
    pub tx_id:  String,
    pub signed: bool,
}

// ── Fee Engine ──────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct FeeSkillSettleRequest {
    pub stake_kas: f64,
    pub network:   Option<String>,
}

#[derive(Serialize)]
pub struct FeeSkillSettleResponse {
    pub total_pool:          f64,
    pub protocol_fee:        f64,
    pub winner_payout:       f64,
    pub protocol_fee_sompi:  u64,
    pub winner_payout_sompi: u64,
    pub fee_breakdown:       String,
    pub treasury_address:    String,
}

/// NEW: Draw settle request/response
#[derive(Deserialize)]
pub struct FeeDrawSettleRequest {
    pub stake_kas: f64,
    pub network:   Option<String>,
}

#[derive(Serialize)]
pub struct FeeDrawSettleResponse {
    pub stake_kas:          f64,
    pub protocol_fee:       f64,
    pub refund:             f64,
    pub protocol_fee_sompi: u64,
    pub refund_sompi:       u64,
    pub fee_breakdown:      String,
    pub treasury_address:   String,
}

#[derive(Deserialize)]
pub struct CancelCheckRequest {
    pub game_status:     String,
    pub opponent_joined: bool,
}

#[derive(Serialize)]
pub struct CancelCheckResponse {
    pub allowed: bool,
    pub reason:  String,
}

#[derive(Deserialize)]
pub struct MaximizerWinRequest {
    pub bet_kas: f64,
    pub odds:    f64,
    pub network: Option<String>,
}

#[derive(Serialize)]
pub struct MaximizerWinResponse {
    pub gross_payout:    f64,
    pub protocol_fee:    f64,
    pub net_payout:      f64,
    pub hedge_returned:  f64,
    pub total_received:  f64,
    pub fee_breakdown:   String,
    pub treasury_address: String,
}

#[derive(Deserialize)]
pub struct MaximizerLoseRequest {
    pub bet_kas: f64,
    pub network: Option<String>,
}

#[derive(Serialize)]
pub struct MaximizerLoseResponse {
    pub pool_lost:        f64,
    pub hedge_fee:        f64,
    pub hedge_recovered:  f64,
    pub net_loss:         f64,
    pub fee_breakdown:    String,
    pub treasury_address: String,
}

#[derive(Serialize)]
pub struct MaximizerSplitResponse {
    pub pool_contribution:  f64,
    pub hedge_amount:       f64,
    pub effective_pool_bet: f64,
}

#[derive(Deserialize)]
pub struct TreasuryRequest {
    pub network: Option<String>,
}

#[derive(Serialize)]
pub struct TreasuryResponse {
    pub treasury_address: String,
    pub network:          String,
}

// ── Settlement ─────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct SettlementPreviewRequest {
    pub match_id:   String,
    pub stake_kas:  f64,
    pub is_draw:    Option<bool>,
    pub winner_str: Option<String>,
    pub network:    Option<String>,
}

#[derive(Serialize)]
pub struct SettlementPreviewResponse {
    pub match_id:            String,
    pub is_draw:             bool,
    pub stake_kas:           f64,
    pub total_pool:          f64,
    pub protocol_fee:        f64,
    pub winner_payout:       f64,
    pub treasury_address:    String,
}

#[derive(Deserialize)]
pub struct CovenantValidateRequest {
    pub escrow_address:    String,
    pub redeem_script_hex: String,
    pub pubkey_a:          String,
    pub pubkey_b:          String,
    pub network:           Option<String>,
}

#[derive(Serialize)]
pub struct CovenantValidateResponse {
    pub valid:   bool,
    pub reason:  String,
}

// ── Deadline ────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct DeadlineCreateRequest {
    pub match_id:       String,
    pub timeout_secs:   u64,
    pub current_daa:    u64,
    pub network:        Option<String>,
}

#[derive(Serialize)]
pub struct DeadlineCreateResponse {
    pub match_id:     String,
    pub deadline_daa: u64,
    pub expires_in:   u64,
}

#[derive(Deserialize)]
pub struct DeadlineCheckRequest {
    pub match_id:    String,
    pub current_daa: u64,
}

#[derive(Serialize)]
pub struct DeadlineCheckResponse {
    pub match_id: String,
    pub expired:  bool,
    pub remaining_daa: i64,
}

#[derive(Serialize)]
pub struct DaaResponse {
    pub virtual_daa_score: u64,
}

// ── Autopayout ─────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ResolveWinnerRequest {
    pub winner_raw:        String,
    pub creator_player_id: Option<String>,
    pub joiner_player_id:  Option<String>,
    pub creator_address:   Option<String>,
    pub joiner_address:    Option<String>,
    pub game:              Option<String>,
}

#[derive(Serialize)]
pub struct ResolveWinnerResponse {
    pub winner_address: Option<String>,
    pub is_draw:        bool,
    pub winner_str:     String,
}

#[derive(Deserialize)]
pub struct PrepareSettlementRequest {
    pub match_id:          String,
    pub game:              Option<String>,
    pub winner_raw:        String,
    pub reason:            Option<String>,
    pub stake_kas:         f64,
    pub creator_address:   Option<String>,
    pub joiner_address:    Option<String>,
    pub creator_player_id: Option<String>,
    pub joiner_player_id:  Option<String>,
    pub redeem_script_hex: Option<String>,
    pub network:           Option<String>,
}

#[derive(Serialize)]
pub struct PrepareSettlementResponse {
    pub match_id:             String,
    pub is_draw:              bool,
    pub winner_address:       Option<String>,
    pub creator_address:      Option<String>,
    pub joiner_address:       Option<String>,
    pub winner_str:           String,
    pub stake_kas:            f64,
    pub total_pool:           f64,
    pub winner_payout_sompi:  u64,
    pub protocol_fee_sompi:   u64,
    pub treasury_address:     String,
    pub fee_breakdown:        String,
    pub covenant_ok:          bool,
    pub network:              String,
}

// ── Markets ────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct MarketCreateRequest {
    pub title:        String,
    pub description:  Option<String>,
    pub outcomes:     Vec<String>,
    pub network:      Option<String>,
}

#[derive(Serialize)]
pub struct MarketCreateResponse {
    pub market_id:     String,
    pub title:         String,
    pub outcomes:      Vec<String>,
    pub treasury_address: String,
}

#[derive(Deserialize)]
pub struct BetPlaceRequest {
    pub market_id:   String,
    pub outcome_idx: usize,
    pub bet_kas:     f64,
    pub bettor:      String,
}

#[derive(Serialize)]
pub struct BetPlaceResponse {
    pub valid:       bool,
    pub reason:      String,
    pub market_id:   String,
    pub outcome_idx: usize,
    pub bet_kas:     f64,
}

#[derive(Deserialize)]
pub struct OddsRequest {
    pub pool_sizes: Vec<f64>,
    pub outcome_idx: usize,
}

#[derive(Serialize)]
pub struct OddsResponse {
    pub outcome_idx: usize,
    pub odds:        f64,
    pub implied_prob: f64,
}

// ── Broadcast ───────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct BroadcastRequest {
    pub raw_tx:  String,
    pub network: Option<String>,
}

#[derive(Serialize)]
pub struct BroadcastResponse {
    pub tx_id:   String,
    pub accepted: bool,
}

// ── Oracle commit ────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct OracleCommitRequest {
    pub match_id:   String,
    pub result:     String,
    pub attester:   String,
    pub signature:  Option<String>,
}

#[derive(Serialize)]
pub struct OracleCommitResponse {
    pub accepted:   bool,
    pub commit_hash: String,
    pub reason:     String,
}

#[derive(Deserialize)]
pub struct AutoAttestRequest {
    pub match_id:  String,
    pub game:      String,
    pub moves:     Vec<String>,
    pub network:   Option<String>,
}

#[derive(Serialize)]
pub struct AutoAttestResponse {
    pub match_id:   String,
    pub result:     String,
    pub attested:   bool,
    pub commit_hash: String,
}
