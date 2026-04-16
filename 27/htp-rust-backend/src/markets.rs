//! markets.rs — HTP Prediction Market CRUD
//!
//! Ports htp-events-v3.js + htp-event-creator.js to Rust.
//!
//! Firebase is still the persistence layer (Firestore/RTDB).
//! This module handles all *validation and business logic* server-side;
//! the thin JS shims in the browser call these endpoints.
//!
//! Routes:
//!   POST /markets/create     — validate + build market record
//!   POST /markets/bet        — validate a bet placement
//!   POST /markets/odds       — compute current odds for a market

use crate::types::*;
use anyhow::Result;

/// Generate a deterministic market ID from timestamp + random suffix.
/// Format: MKT-{base36(ts)}-{4-char random}
pub fn generate_market_id() -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let ts_b36 = to_base36(ts);
    let suffix = rand_suffix(4);
    format!("MKT-{}-{}", ts_b36.to_uppercase(), suffix)
}

fn to_base36(mut n: u64) -> String {
    if n == 0 { return "0".to_string(); }
    const CHARS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = Vec::new();
    while n > 0 {
        out.push(CHARS[(n % 36) as usize] as char);
        n /= 36;
    }
    out.into_iter().rev().collect()
}

fn rand_suffix(len: usize) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    std::time::SystemTime::now().hash(&mut h);
    let v = h.finish();
    let chars: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars().collect();
    (0..len).map(|i| chars[((v >> (i * 5)) & 0x1f) as usize % chars.len()]).collect()
}

/// Validate and build a market creation record.
/// Returns the market payload ready to write to Firebase.
pub fn create_market(req: &MarketCreateRequest) -> Result<MarketCreateResponse> {
    // Validation
    if req.title.trim().is_empty() {
        anyhow::bail!("title is required");
    }
    if req.description.trim().is_empty() {
        anyhow::bail!("description is required");
    }
    if req.outcomes.len() < 2 {
        anyhow::bail!("at least 2 outcomes are required");
    }
    if req.resolution_date == 0 {
        anyhow::bail!("resolution_date (unix seconds) is required");
    }
    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    if req.resolution_date <= now_secs {
        anyhow::bail!("resolution_date must be in the future");
    }
    if let Some(ref url) = req.source_url {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            anyhow::bail!("source_url must be a valid HTTP/HTTPS URL");
        }
    }
    if req.min_position.unwrap_or(1.0) <= 0.0 {
        anyhow::bail!("min_position must be positive");
    }

    let market_id = generate_market_id();

    tracing::info!(
        "[markets] created market {} title=\"{}\" outcomes={}",
        &market_id, &req.title, req.outcomes.len()
    );

    Ok(MarketCreateResponse {
        market_id:       market_id,
        title:           req.title.trim().to_string(),
        description:     req.description.trim().to_string(),
        outcomes:        req.outcomes.clone(),
        resolution_date: req.resolution_date,
        source_url:      req.source_url.clone(),
        min_position:    req.min_position.unwrap_or(1.0),
        max_participants: req.max_participants,
        creator_address: req.creator_address.clone(),
        status:          "active".to_string(),
    })
}

/// Validate a bet placement request.
pub fn validate_bet(req: &BetPlaceRequest) -> Result<BetPlaceResponse> {
    if req.market_id.is_empty() {
        anyhow::bail!("market_id is required");
    }
    if req.player_address.is_empty() {
        anyhow::bail!("player_address is required");
    }
    if req.outcome_index > 31 {
        anyhow::bail!("outcome_index out of range");
    }
    if req.amount_kas <= 0.0 {
        anyhow::bail!("amount_kas must be positive");
    }

    let amount_sompi = (req.amount_kas * 100_000_000.0).round() as u64;
    let position_id  = format!("{}-{}-{}", req.market_id, req.player_address.get(..8).unwrap_or(&req.player_address), req.outcome_index);

    tracing::info!(
        "[markets] bet market={} outcome={} amount={:.4} KAS player={}",
        &req.market_id, req.outcome_index, req.amount_kas,
        &req.player_address.get(..12).unwrap_or(&req.player_address)
    );

    Ok(BetPlaceResponse {
        position_id,
        market_id:      req.market_id.clone(),
        player_address: req.player_address.clone(),
        outcome_index:  req.outcome_index,
        amount_kas:     req.amount_kas,
        amount_sompi,
        status:         "pending".to_string(),
    })
}

/// Compute current odds for each outcome given existing positions.
pub fn compute_odds(req: &OddsRequest) -> OddsResponse {
    let total: f64 = req.position_totals.iter().sum();
    let n = req.position_totals.len();
    let even = if n > 0 { 100.0 / n as f64 } else { 100.0 };

    let odds: Vec<f64> = req.position_totals.iter().map(|&pos| {
        if total > 0.0 { (pos / total) * 100.0 } else { even }
    }).collect();

    OddsResponse {
        odds_pct: odds.clone(),
        total_pool_kas: total,
        implied_multipliers: odds.iter().map(|&o| {
            if o > 0.0 { 100.0 / o } else { 0.0 }
        }).collect(),
    }
}
