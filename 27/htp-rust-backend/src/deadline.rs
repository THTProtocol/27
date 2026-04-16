//! deadline.rs — DAA-score based match timing
//!
//! Ports htp-match-deadline.js to Rust.
//!
//! Why DAA score instead of wall clock:
//!   - DAA score increments ~10×/sec on Kaspa mainnet
//!   - Chain-verified — no client can fake it
//!   - A DAA delta is fully reproducible by any node
//!   - Disconnected clients can't cheat time by pausing system clock
//!
//! Routes:
//!   POST /deadline/create   — compute target DAA score from seconds
//!   POST /deadline/check    — check if a deadline has expired
//!   GET  /deadline/daa      — current DAA score from Kaspa REST

use crate::types::*;
use anyhow::Result;

/// Kaspa mainnet: ~10 DAA ticks per second.
pub const DAA_PER_SEC: u64 = 10;

/// Convert seconds → DAA delta (ceiling).
pub fn seconds_to_daa(seconds: f64) -> u64 {
    (seconds.ceil() as u64).saturating_mul(DAA_PER_SEC)
}

/// Convert DAA delta → seconds.
pub fn daa_to_seconds(daa: u64) -> f64 {
    daa as f64 / DAA_PER_SEC as f64
}

/// Create a deadline: given current DAA score + duration in seconds,
/// return the absolute target DAA score the client should store.
pub fn create_deadline(req: &DeadlineCreateRequest) -> DeadlineCreateResponse {
    let deadline_daa = if let Some(abs) = req.daa_score {
        // Absolute target provided directly (covenant-anchored)
        abs
    } else {
        let secs = req.seconds.unwrap_or(300.0); // default 5 min
        req.current_daa.saturating_add(seconds_to_daa(secs))
    };

    let remaining_daa = deadline_daa.saturating_sub(req.current_daa);
    let remaining_secs = daa_to_seconds(remaining_daa);

    DeadlineCreateResponse {
        deadline_daa,
        current_daa: req.current_daa,
        remaining_daa,
        remaining_secs,
        label: req.label.clone().unwrap_or_else(|| "match".into()),
        expired: remaining_daa == 0,
    }
}

/// Check if a previously created deadline has expired.
pub fn check_deadline(req: &DeadlineCheckRequest) -> DeadlineCheckResponse {
    let expired       = req.current_daa >= req.deadline_daa;
    let remaining_daa = req.deadline_daa.saturating_sub(req.current_daa);
    let remaining_secs = daa_to_seconds(remaining_daa);

    DeadlineCheckResponse {
        expired,
        remaining_daa,
        remaining_secs,
        current_daa: req.current_daa,
        deadline_daa: req.deadline_daa,
    }
}

/// Fetch the current virtual DAA score from the Kaspa REST API.
pub async fn fetch_current_daa(api_base: &str) -> Result<u64> {
    let client  = reqwest::Client::new();
    let url     = format!("{}/info/blockdag", api_base);
    let resp: serde_json::Value = client.get(&url).send().await?.json().await?;

    let daa = resp
        .get("virtualDaaScore")
        .or_else(|| resp.get("virtual_daa_score"))
        .and_then(|v| v.as_u64())
        .ok_or_else(|| anyhow::anyhow!("virtualDaaScore not found in blockdag info"))?;

    Ok(daa)
}
