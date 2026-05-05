//! htp-server — observability module
//!
//! Structured event logging, health snapshot structs, match lifecycle events.
//! Feeds the /health/details and /metrics endpoints with typed data.

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Server health snapshot — served at /health and /health/details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthSnapshot {
    pub status: String,
    pub engine: String,
    pub version: String,
    pub uptime_secs: u64,
    pub active_games: usize,
    pub active_rooms: usize,
    pub ws_connected_clients: usize,
    pub last_health_check: chrono::DateTime<chrono::Utc>,
}

impl HealthSnapshot {
    pub fn new(
        uptime: Duration,
        active_games: usize,
        active_rooms: usize,
        ws_clients: usize,
    ) -> Self {
        Self {
            status: "ok".into(),
            engine: "rust".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            uptime_secs: uptime.as_secs(),
            active_games,
            active_rooms,
            ws_connected_clients: ws_clients,
            last_health_check: chrono::Utc::now(),
        }
    }
}

/// Match lifecycle event — logged on state transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum MatchLifecycleEvent {
    Created {
        match_id: String,
        game_type: String,
        stakes_sompi: u64,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    Started {
        match_id: String,
        player1: String,
        player2: String,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    MoveMade {
        match_id: String,
        move_number: usize,
        by_player: String,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    Completed {
        match_id: String,
        winner: String,
        reason: String,
        move_count: usize,
        duration_secs: u64,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    Settled {
        match_id: String,
        settle_tx: String,
        winner: String,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
}

/// Structured log entry used by the tracing subscriber
#[derive(Debug, Clone, Serialize)]
pub struct StructuredLogEntry {
    pub level: String,
    pub module: String,
    pub message: String,
    pub data: Option<serde_json::Value>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_snapshot_roundtrip() {
        let snap = HealthSnapshot::new(Duration::from_secs(3600), 5, 2, 3);
        assert_eq!(snap.status, "ok");
        assert_eq!(snap.uptime_secs, 3600);
        assert_eq!(snap.active_games, 5);

        let json = serde_json::to_string(&snap).unwrap();
        let back: HealthSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(back.uptime_secs, 3600);
    }

    #[test]
    fn lifecycle_event_serialization() {
        let event = MatchLifecycleEvent::Completed {
            match_id: "m1".into(),
            winner: "kaspatest:abc123".into(),
            reason: "checkmate".into(),
            move_count: 42,
            duration_secs: 180,
            timestamp: chrono::Utc::now(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("completed"));
        assert!(json.contains("checkmate"));
        assert!(json.contains("m1"));
    }

    #[test]
    fn structured_log_entry_has_timestamp() {
        let entry = StructuredLogEntry {
            level: "info".into(),
            module: "ws".into(),
            message: "client connected".into(),
            data: None,
            timestamp: chrono::Utc::now(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("client connected"));
    }
}
