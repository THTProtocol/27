//! fee.rs — HTP Protocol Fee & Maximizer Engine v2
//!
//! Routes served:
//!   POST /fee/skill-settle    — skill game settlement amounts
//!   POST /fee/draw-settle     — draw settlement amounts (NEW)
//!   POST /fee/maximizer-win   — maximizer win payout
//!   POST /fee/maximizer-lose  — maximizer loss / hedge recovery
//!   POST /fee/treasury        — current treasury address for network
//!   POST /fee/cancel-check    — can creator cancel?

use crate::types::*;
use anyhow::Result;

// ── Treasury addresses (canonical) ───────────────────────────────────────
pub const TREASURY_MAINNET: &str =
    "kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel";
pub const TREASURY_TN12: &str =
    "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m";

// ── Fee constants ─────────────────────────────────────────────────────
pub const SKILL_GAME_WIN_PCT: f64     = 0.02;
pub const DRAW_FEE_PCT: f64           = 0.01;  // 1% of one player's stake
pub const EVENT_WIN_PCT: f64          = 0.02;
pub const MAXIMIZER_HEDGE_LOSS_PCT: f64 = 0.30;
pub const MAXIMIZER_POOL_CONTRIBUTION: f64 = 0.50;
pub const SOMPI_PER_KAS: u64          = 100_000_000;
pub const NETWORK_FEE_SOMPI: u64      = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────
pub fn treasury_address(network: &str) -> &'static str {
    if network.contains("main") { TREASURY_MAINNET } else { TREASURY_TN12 }
}

pub fn kas_to_sompi(kas: f64) -> u64 {
    (kas * SOMPI_PER_KAS as f64).round() as u64
}

pub fn sompi_to_kas(sompi: u64) -> f64 {
    sompi as f64 / SOMPI_PER_KAS as f64
}

// ── Skill game win settlement ─────────────────────────────────────────────
pub fn skill_game_settle(req: &FeeSkillSettleRequest) -> Result<FeeSkillSettleResponse> {
    let stake = req.stake_kas;
    if stake <= 0.0 { anyhow::bail!("stake_kas must be positive"); }
    let network       = req.network.as_deref().unwrap_or("testnet-12");
    let total_pool    = stake * 2.0;
    let protocol_fee  = total_pool * SKILL_GAME_WIN_PCT;
    let winner_payout = total_pool - protocol_fee;
    Ok(FeeSkillSettleResponse {
        total_pool,
        protocol_fee,
        winner_payout,
        protocol_fee_sompi:  kas_to_sompi(protocol_fee),
        winner_payout_sompi: kas_to_sompi(winner_payout),
        fee_breakdown: format!("2% of {:.4} KAS pool", total_pool),
        treasury_address: treasury_address(network).to_string(),
    })
}

// ── Draw settlement (NEW — was missing, caused 404) ───────────────────────
/// 1% of one player's stake deducted as protocol fee.
/// Each player receives: stake - (stake * 0.01)
pub fn draw_settle(req: &FeeDrawSettleRequest) -> Result<FeeDrawSettleResponse> {
    let stake = req.stake_kas;
    if stake <= 0.0 { anyhow::bail!("stake_kas must be positive"); }
    let network      = req.network.as_deref().unwrap_or("testnet-12");
    let protocol_fee = stake * DRAW_FEE_PCT;
    let refund       = stake - protocol_fee;
    Ok(FeeDrawSettleResponse {
        stake_kas:           stake,
        protocol_fee,
        refund,
        protocol_fee_sompi:  kas_to_sompi(protocol_fee),
        refund_sompi:        kas_to_sompi(refund),
        fee_breakdown: format!("1% of {:.4} KAS stake = {:.4} KAS fee", stake, protocol_fee),
        treasury_address: treasury_address(network).to_string(),
    })
}

// ── Cancel check ────────────────────────────────────────────────────────────
pub fn skill_game_can_cancel(game_status: &str, opponent_joined: bool) -> CancelCheckResponse {
    let started = opponent_joined
        || (game_status != "waiting" && game_status != "open" && !game_status.is_empty());
    if started {
        CancelCheckResponse { allowed: false, reason: "Game already started — leaving counts as forfeit".into() }
    } else {
        CancelCheckResponse { allowed: true,  reason: "No opponent yet — full refund available".into() }
    }
}

// ── Maximizer ────────────────────────────────────────────────────────────────
pub fn maximizer_split(bet_kas: f64) -> MaximizerSplitResponse {
    let pool = bet_kas * MAXIMIZER_POOL_CONTRIBUTION;
    MaximizerSplitResponse { pool_contribution: pool, hedge_amount: pool, effective_pool_bet: pool }
}

pub fn maximizer_win_settle(req: &MaximizerWinRequest) -> Result<MaximizerWinResponse> {
    let bet  = req.bet_kas;
    let odds = req.odds;
    if bet <= 0.0 || odds <= 1.0 { anyhow::bail!("bet_kas must be positive, odds must be > 1.0"); }
    let gross_payout = bet * odds;
    let net_winnings = gross_payout - bet;
    let protocol_fee = net_winnings * EVENT_WIN_PCT;
    let net_payout   = gross_payout - protocol_fee;
    let hedge        = maximizer_split(bet).hedge_amount;
    Ok(MaximizerWinResponse {
        gross_payout,
        protocol_fee,
        net_payout,
        hedge_returned: hedge,
        total_received: net_payout + hedge,
        fee_breakdown: format!("2% of {:.4} KAS net winnings = {:.4} KAS", net_winnings, protocol_fee),
        treasury_address: treasury_address(req.network.as_deref().unwrap_or("testnet-12")).to_string(),
    })
}

pub fn maximizer_lose_settle(req: &MaximizerLoseRequest) -> Result<MaximizerLoseResponse> {
    let bet = req.bet_kas;
    if bet <= 0.0 { anyhow::bail!("bet_kas must be positive"); }
    let hedge           = maximizer_split(bet).hedge_amount;
    let hedge_fee       = hedge * MAXIMIZER_HEDGE_LOSS_PCT;
    let hedge_recovered = hedge - hedge_fee;
    Ok(MaximizerLoseResponse {
        pool_lost: bet * MAXIMIZER_POOL_CONTRIBUTION,
        hedge_fee,
        hedge_recovered,
        net_loss: bet - hedge_recovered,
        fee_breakdown: format!("30% of {:.4} KAS hedge = {:.4} KAS fee; recover {:.4} KAS", hedge, hedge_fee, hedge_recovered),
        treasury_address: treasury_address(req.network.as_deref().unwrap_or("testnet-12")).to_string(),
    })
}
