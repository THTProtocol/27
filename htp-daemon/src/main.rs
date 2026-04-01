//! htp-daemon — High Table Protocol Kaspa daemon
//!
//! Responsibilities:
//!   1. Watch Firebase for completed matches → execute settlement TX on Kaspa
//!   2. Watch Firebase for resolved events  → execute settlement TX on Kaspa
//!   3. Poll external APIs for event results → write oracle attestations
//!   4. Watch DAA deadlines → trigger timeout settlements
//!   5. Write heartbeat to Firebase /daemon/heartbeat
//!
//! Architecture:
//!   - All Kaspa TX construction, signing, and submission happens HERE in Rust.
//!   - Firebase is read/write for coordination only (no secrets stored there).
//!   - Browser JS handles wallet connect, game engine, and UI only.
//!   - Escrow private keys live in ./escrow-keys.json (local, never in Firebase).

use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::interval;
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

mod deadline;
mod firebase;
mod kaspa;
mod oracle;
mod settlement;
mod types;

use crate::deadline::DeadlineRegistry;
use crate::firebase::{FirebaseClient, ServiceAccountKey};
use crate::oracle::Oracle;
use crate::settlement::{load_escrow_keys, settle_skill_game, SettlementLock};
use crate::types::KaspaNetwork;

// ── Config ─────────────────────────────────────────────────────────────────────

struct Config {
    network:            KaspaNetwork,
    firebase_db_url:    String,
    oracle_private_key: String,
    oracle_threshold:   u32,
    poll_interval_ms:   u64,
    escrow_keys_path:   String,
}

fn load_config() -> Config {
    dotenv::dotenv().ok();
    Config {
        network: KaspaNetwork::from_str(
            &std::env::var("KASPA_NETWORK").unwrap_or_else(|_| "tn12".into())
        ),
        firebase_db_url: std::env::var("FIREBASE_DB_URL")
            .expect("FIREBASE_DB_URL must be set in .env"),
        oracle_private_key: std::env::var("ORACLE_PRIVATE_KEY")
            .expect("ORACLE_PRIVATE_KEY must be set in .env"),
        oracle_threshold: std::env::var("ORACLE_THRESHOLD")
            .unwrap_or_else(|_| "1".into())
            .parse().unwrap_or(1),
        poll_interval_ms: std::env::var("POLL_INTERVAL_MS")
            .unwrap_or_else(|_| "5000".into())
            .parse().unwrap_or(5000),
        escrow_keys_path: std::env::var("ESCROW_KEYS_PATH")
            .unwrap_or_else(|_| "./escrow-keys.json".into()),
    }
}

// ── Main ───────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    // Logging
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env()
            .add_directive("htp_daemon=info".parse().unwrap()))
        .init();

    let cfg = load_config();
    let rest_url = cfg.network.rest_url().to_string();

    info!("HTP Daemon v1.0 starting");
    info!("Network:  {}", cfg.network.network_id());
    info!("Firebase: {}", cfg.firebase_db_url);
    info!("REST:     {}", rest_url);
    info!("Treasury: {}", cfg.network.treasury_address());

    // HTTP client
    let http = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    // Firebase client
    let svc_key_path = std::env::var("FIREBASE_SERVICE_KEY_PATH")
        .unwrap_or_else(|_| "./serviceAccountKey.json".into());
    let svc_key: ServiceAccountKey = serde_json::from_str(
        &std::fs::read_to_string(&svc_key_path)
            .unwrap_or_else(|_| panic!("Cannot read Firebase service key: {}", svc_key_path))
    ).expect("Invalid Firebase service key JSON");
    let fb = FirebaseClient::new(cfg.firebase_db_url.clone(), svc_key, http.clone());

    // Oracle
    let oracle = Oracle::new(
        cfg.oracle_private_key.clone(),
        cfg.network.clone(),
        cfg.oracle_threshold,
    );
    info!("Oracle identity: {}", oracle.address);

    // Escrow key store (local, never in Firebase)
    let key_store  = load_escrow_keys(&cfg.escrow_keys_path);
    let settle_lock = SettlementLock::default();
    let deadlines   = DeadlineRegistry::default();

    let network = cfg.network.clone();

    // Write startup heartbeat
    let _ = fb.update("daemon/heartbeat", &json!({
        "status":    "online",
        "version":   "1.0",
        "network":   network.network_id(),
        "treasury":  network.treasury_address(),
        "startedAt": chrono::Utc::now().timestamp_millis(),
    })).await;

    let poll_ms = cfg.poll_interval_ms;
    let mut tick = interval(Duration::from_millis(poll_ms));

    info!("Poll loop started ({}ms interval)", poll_ms);

    loop {
        tick.tick().await;

        // ── 1. Fetch current DAA score ────────────────────────────────────────
        let daa = match kaspa::fetch_daa_score(&http, &rest_url).await {
            Ok(d)  => d,
            Err(e) => { warn!("DAA fetch failed: {}", e); continue; }
        };

        // ── 2. Check deadlines ────────────────────────────────────────────────
        let expired = deadlines.check(daa);
        for match_id in &expired {
            info!("DAA deadline expired: {} — triggering timeout settlement", match_id);
            // Fetch match data and settle as timeout
            if let Ok(Some(md)) = fb.get(&format!("matches/{}", match_id)).await {
                let mut timeout_data = md.clone();
                timeout_data["info"]["winner"] = json!("timeout");
                // Timeout = creator forfeit (no one moved in time)
                // Award to the last player who moved, or split if neither moved
                let _ = settle_skill_game(
                    match_id, &timeout_data, &fb, &http, &rest_url,
                    &network, &settle_lock, &key_store
                ).await;
            }
        }

        // ── 3. Scan completed matches ─────────────────────────────────────────
        match fb.get("matches").await {
            Ok(Some(matches)) => {
                if let Some(obj) = matches.as_object() {
                    for (match_id, match_data) in obj {
                        let info   = &match_data["info"];
                        let status = info["status"].as_str().unwrap_or("");

                        // Register deadline if present and not yet registered
                        if let Some(daa_str) = info["deadlineDaa"].as_str() {
                            if let Ok(target) = daa_str.parse::<u64>() {
                                if status == "active" {
                                    deadlines.register(match_id, target, "match");
                                }
                            }
                        }

                        // Trigger settlement for completed matches
                        if status == "completed" && info["settleTxId"].is_null() {
                            info!("Completed match found: {}", match_id);
                            let _ = settle_skill_game(
                                match_id, match_data, &fb, &http, &rest_url,
                                &network, &settle_lock, &key_store
                            ).await;
                        }
                    }
                }
            }
            Err(e) => warn!("Failed to read matches: {}", e),
            _ => {}
        }

        // ── 4. Scan events (oracle + settlement) ──────────────────────────────
        match fb.get("events").await {
            Ok(Some(events)) => {
                if let Some(obj) = events.as_object() {
                    let now = chrono::Utc::now().timestamp_millis();
                    for (event_id, event_data) in obj {
                        let status     = event_data["status"].as_str().unwrap_or("");
                        let close_time = event_data["closeTime"].as_i64().unwrap_or(0);

                        // Skip resolved / cancelled
                        if status == "resolved" || status == "cancelled" { continue; }

                        // Skip if not yet closed
                        if close_time > now { continue; }

                        // Try to resolve via external API
                        if let Some(outcome) = oracle::resolve_event(
                            event_data, &http, &rest_url
                        ).await {
                            let source = event_data["source"].as_str().unwrap_or("daemon");
                            match oracle::attest_event(
                                &oracle, event_id, &outcome, source, &fb,
                                cfg.oracle_threshold
                            ).await {
                                Ok(finalised) => {
                                    if finalised {
                                        info!("Event {} finalised → {}", event_id, outcome);
                                    }
                                }
                                Err(e) => error!("Attest failed for {}: {}", event_id, e),
                            }
                        }
                    }
                }
            }
            Err(e) => warn!("Failed to read events: {}", e),
            _ => {}
        }

        // ── 5. Heartbeat ──────────────────────────────────────────────────────
        let _ = fb.update("daemon/heartbeat", &json!({
            "ts":           chrono::Utc::now().timestamp_millis(),
            "daaScore":     daa,
            "activeDeadlines": deadlines.active_count(),
        })).await;
    }
}
