//! settlement.rs — HTP Settlement Pipeline
//!
//! Ports the covenant integrity guard + settlement amount calculation
//! from htp-autopayout-engine.js and htp-settlement-preview.js.
//!
//! Routes:
//!   POST /settlement/preview   — compute winner/fee/treasury before TX fires
//!   POST /settlement/validate  — covenant integrity check (redeemScript vs treasury)

use crate::types::*;
use crate::fee;
use anyhow::Result;

/// Compute a settlement preview — amounts, addresses, fee breakdown.
/// Called before any TX is constructed so the UI can show a confirmation.
pub fn settlement_preview(req: &SettlementPreviewRequest) -> Result<SettlementPreviewResponse> {
    let network  = req.network.as_deref().unwrap_or("testnet-12");
    let stake    = req.stake_kas;

    if stake <= 0.0 {
        anyhow::bail!("stake_kas must be positive");
    }

    // Reuse fee engine
    let fee_req = FeeSkillSettleRequest {
        stake_kas: stake,
        network: Some(network.to_string()),
    };
    let amounts = fee::skill_game_settle(&fee_req)?;

    let is_draw = req.is_draw.unwrap_or(false);

    let (winner_amount, player_a_amount, player_b_amount) = if is_draw {
        // Draw: each player gets back stake minus half the fee
        let half_fee   = amounts.protocol_fee / 2.0;
        let each_back  = stake - half_fee;
        (0.0, each_back, each_back)
    } else {
        (amounts.winner_payout, amounts.winner_payout, 0.0)
    };

    Ok(SettlementPreviewResponse {
        stake_kas:            stake,
        total_pool:           amounts.total_pool,
        winner_amount,
        player_a_amount,
        player_b_amount,
        protocol_fee:         amounts.protocol_fee,
        protocol_fee_sompi:   amounts.protocol_fee_sompi,
        winner_payout_sompi:  amounts.winner_payout_sompi,
        treasury_address:     amounts.treasury_address,
        fee_breakdown:        amounts.fee_breakdown,
        is_draw,
        network: network.to_string(),
    })
}

/// Covenant integrity check.
///
/// Validates that the redeem script encodes the *current* treasury address.
/// If the treasury address ever changes, old escrows would route fees to the
/// wrong address — this guard prevents settling such escrows silently.
pub fn validate_covenant(req: &CovenantValidateRequest) -> CovenantValidateResponse {
    let network  = req.network.as_deref().unwrap_or("testnet-12");
    let expected = fee::treasury_address(network);

    // The redeem script hex should contain the treasury SPK.
    // SPK for a Kaspa address is the BLAKE2b-256 hash of the pubkey in hex.
    // We check that the treasury address string appears embedded in script hex
    // (simplified check — full Schnorr SPK decode is in escrow.rs).
    let script_lower  = req.redeem_script_hex.to_lowercase();
    let treasury_lower = expected.to_lowercase();

    // Extract the hash portion of the treasury address (after the prefix:q/pq)
    let treasury_hash = treasury_lower
        .split(':')
        .nth(1)
        .and_then(|s| s.strip_prefix('q').or_else(|| s.strip_prefix("pq")))
        .unwrap_or("");

    let valid = !treasury_hash.is_empty() && script_lower.contains(treasury_hash);

    CovenantValidateResponse {
        valid,
        expected_treasury: expected.to_string(),
        found_in_script: valid,
        error: if valid { None } else {
            Some(format!(
                "Treasury address {} not found in redeemScript — covenant mismatch",
                expected
            ))
        },
    }
}
