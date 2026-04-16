//! oracle_commit.rs — HTP Oracle Commit Pipeline
//!
//! Ports htp-zk-pipeline.js (formerly htp-oracle-pipeline.js) to Rust.
//!
//! Current proof system: SHA-256 commit written to Firebase.
//! Toccata HF upgrade path: swap proof_system to 'groth16' or 'r0succinct'
//! and push [proof_bytes, ZkTag] OP_ZK_VERIFY into the settlement script.
//!
//! Toccata zk_precompile tags (kaspanet/rusty-kaspa covpp-reset2):
//!   ZkTag::Groth16    = 0x20  cost: 140,000 script-units
//!   ZkTag::R0Succinct = 0x21  cost: 250,000 script-units
//!
//! Routes:
//!   POST /oracle/commit        — submit SHA-256 attestation commit
//!   POST /oracle/auto-attest   — daemon auto-attest for a closed market

use crate::types::*;
use anyhow::Result;
use sha2::{Sha256, Digest};
use hex;

/// Toccata ZK precompile tags (for future on-chain proof submission).
#[allow(dead_code)]
pub mod zk_tag {
    pub const GROTH16: u8     = 0x20;
    pub const R0_SUCCINCT: u8 = 0x21;
}

/// Build a SHA-256 commit hash from attestation fields.
/// Format: "{evidence}:{outcome}:{market_id}:{oracle_addr}:{timestamp}"
pub fn build_commit_hash(evidence: &str, outcome: &str, market_id: &str, oracle_addr: &str, ts: u64) -> String {
    let raw = format!("{}:{}:{}:{}:{}", evidence, outcome, market_id, oracle_addr, ts);
    let mut h = Sha256::new();
    h.update(raw.as_bytes());
    hex::encode(h.finalize())
}

/// Submit an oracle attestation commit.
pub fn submit_attestation(req: &OracleCommitRequest) -> OracleCommitResponse {
    let ts = req.submitted_at.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    });

    let commit_hash = build_commit_hash(
        &req.evidence_url,
        &req.outcome,
        &req.market_id,
        &req.oracle_addr,
        ts,
    );

    let dispute_ends_at = ts + 24 * 60 * 60 * 1000; // 24h window

    tracing::info!(
        "[oracle_commit] market={} outcome={} commit={}…",
        &req.market_id,
        &req.outcome,
        &commit_hash[..16]
    );

    OracleCommitResponse {
        market_id:       req.market_id.clone(),
        oracle_addr:     req.oracle_addr.clone(),
        outcome:         req.outcome.clone(),
        evidence_url:    req.evidence_url.clone(),
        commit_hash:     commit_hash,
        proof_system:    "commit".to_string(),
        zk_tag:          None,          // set to 0x20 post-Toccata HF
        toccata_ready:   true,
        submitted_at:    ts,
        dispute_ends_at,
        status:          "submitted".to_string(),
    }
}

/// Auto-attest a closed market from a daemon poll cycle.
/// Fetches `api_url`, matches outcome against `outcomes` list, builds commit.
pub async fn auto_attest(req: &AutoAttestRequest) -> Result<OracleCommitResponse> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;

    let body: serde_json::Value = client
        .get(&req.api_url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("API fetch failed: {}", e))?
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("API JSON parse failed: {}", e))?;

    // Traverse optional dotted path (e.g. "result.value")
    let raw_val = if let Some(path) = &req.api_path {
        path.split('.')
            .fold(Some(&body), |acc, key| acc?.get(key))
            .cloned()
            .unwrap_or(body.clone())
    } else {
        body.clone()
    };

    let raw_str = match &raw_val {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    };

    // Match against known outcomes (case-insensitive substring)
    let matched = req.outcomes.iter().find(|o| {
        let ol = o.to_lowercase();
        let vl = raw_str.to_lowercase();
        vl.contains(&ol) || ol.contains(&vl)
    });

    let outcome = matched
        .ok_or_else(|| anyhow::anyhow!("No outcome matched API value: {}", raw_str))?;

    let commit_req = OracleCommitRequest {
        market_id:    req.market_id.clone(),
        oracle_addr:  req.oracle_addr.clone(),
        outcome:      outcome.clone(),
        evidence_url: req.api_url.clone(),
        submitted_at: None,
    };

    Ok(submit_attestation(&commit_req))
}
