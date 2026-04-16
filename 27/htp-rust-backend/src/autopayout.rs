//! autopayout.rs — HTP Auto-Payout Settlement Pipeline
//!
//! Ports the settlement resolution logic from htp-autopayout-engine.js v4.1.
//!
//! The browser shim calls these endpoints after the oracle writes the result.
//! This module:
//!   1. Resolves winner address from oracle result + match info
//!   2. Validates covenant integrity (treasury SPK in redeemScript)
//!   3. Computes payout amounts (delegates to fee.rs)
//!   4. Returns a ready-to-sign TX payload (escrow.rs builds the raw TX)
//!
//! Routes:
//!   POST /autopayout/resolve    — resolve winner address from match result
//!   POST /autopayout/prepare    — full settlement prep (covenant check + amounts)

use crate::types::*;
use crate::fee;
use crate::settlement;
use anyhow::Result;

/// Normalize a raw winner value to a canonical string.
/// Matches normalizeWinner() from htp-autopayout-engine.js v4.1.
pub fn normalize_winner(raw: &WinnerRaw, game: &str) -> String {
    match game {
        "c4" | "connect4" | "ck" | "checkers" | "ttt" | "tictactoe" => {
            format!("side{}", raw.value)
        }
        _ => {
            // Chess / default: map to "white" / "black"
            match raw.value.as_str() {
                "w" | "white" | "1" => "white".to_string(),
                "b" | "black" | "2" => "black".to_string(),
                other => other.to_string(),
            }
        }
    }
}

/// Resolve the on-chain winner address from a match result + match info.
/// Returns (winner_address, is_draw).
pub fn resolve_winner_address(req: &ResolveWinnerRequest) -> ResolveWinnerResponse {
    let game     = req.game.to_lowercase();
    let is_draw  = matches!(req.reason.as_str(), "draw" | "stalemate" | "repetition");
    let winner_str = if is_draw {
        "draw".to_string()
    } else {
        normalize_winner(&WinnerRaw { value: req.winner_raw.clone() }, &game)
    };

    let winner_address = if is_draw {
        None
    } else {
        // Map normalized winner to address
        // Chess: white/black → creator/joiner address based on color assignment
        match winner_str.as_str() {
            "white" | "side1" => req.creator_address.clone(),
            "black" | "side2" => req.joiner_address.clone(),
            _ => {
                // Fallback: match by player ID
                if Some(&req.winner_raw) == req.creator_player_id.as_ref() {
                    req.creator_address.clone()
                } else {
                    req.joiner_address.clone()
                }
            }
        }
    };

    tracing::info!(
        "[autopayout] match={} game={} winner_str={} addr={:?} draw={}",
        &req.match_id, &game, &winner_str, &winner_address, is_draw
    );

    ResolveWinnerResponse {
        match_id:        req.match_id.clone(),
        winner_str,
        winner_address,
        is_draw,
        creator_address: req.creator_address.clone(),
        joiner_address:  req.joiner_address.clone(),
    }
}

/// Full settlement preparation:
///   1. Resolve winner
///   2. Covenant integrity check
///   3. Compute amounts
///   Returns everything the browser shim needs to build + sign the TX.
pub fn prepare_settlement(req: &PrepareSettlementRequest) -> Result<PrepareSettlementResponse> {
    let network = req.network.as_deref().unwrap_or("testnet-12");

    // 1. Resolve winner
    let resolve_req = ResolveWinnerRequest {
        match_id:          req.match_id.clone(),
        game:              req.game.clone(),
        winner_raw:        req.winner_raw.clone(),
        reason:            req.reason.clone(),
        creator_address:   req.creator_address.clone(),
        joiner_address:    req.joiner_address.clone(),
        creator_player_id: req.creator_player_id.clone(),
        joiner_player_id:  req.joiner_player_id.clone(),
    };
    let resolved = resolve_winner_address(&resolve_req);

    // 2. Covenant integrity check (if redeemScript provided)
    let covenant_ok = if let Some(ref script) = req.redeem_script_hex {
        let cv_req = CovenantValidateRequest {
            redeem_script_hex: script.clone(),
            network: Some(network.to_string()),
        };
        let cv = settlement::validate_covenant(&cv_req);
        if !cv.valid {
            anyhow::bail!("Covenant integrity check failed: {}", cv.error.unwrap_or_default());
        }
        true
    } else {
        true // no script provided — skip check
    };

    // 3. Fee amounts
    let stake = req.stake_kas;
    let fee_req = FeeSkillSettleRequest {
        stake_kas: stake,
        network: Some(network.to_string()),
    };
    let amounts = fee::skill_game_settle(&fee_req)?;

    Ok(PrepareSettlementResponse {
        match_id:            req.match_id.clone(),
        is_draw:             resolved.is_draw,
        winner_address:      resolved.winner_address,
        creator_address:     resolved.creator_address,
        joiner_address:      resolved.joiner_address,
        winner_str:          resolved.winner_str,
        stake_kas:           stake,
        total_pool:          amounts.total_pool,
        winner_payout_sompi: amounts.winner_payout_sompi,
        protocol_fee_sompi:  amounts.protocol_fee_sompi,
        treasury_address:    amounts.treasury_address,
        fee_breakdown:       amounts.fee_breakdown,
        covenant_ok,
        network:             network.to_string(),
    })
}
