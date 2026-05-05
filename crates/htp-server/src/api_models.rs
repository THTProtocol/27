//! htp-server — API models module
//!
//! Typed request and response structs for all REST endpoints.
//! Used by routes.rs for validation and serialization.

use serde::{Deserialize, Serialize};

// ── Health ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub engine: String,
    pub version: String,
    pub uptime_secs: u64,
}

// ── Health Details ──────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct HealthDetailsResponse {
    pub status: String,
    pub engine: String,
    pub version: String,
    pub uptime_secs: u64,
    pub active_games: usize,
    pub active_rooms: usize,
    pub ws_connected_clients: usize,
    pub errors_total: u64,
}

// ── Metrics / Stats ─────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct MetricsResponse {
    pub active_games: usize,
    pub active_rooms: usize,
    pub settled_matches: usize,
    pub games_by_type: serde_json::Value,
    pub errors_total: u64,
    pub uptime_check: String,
}

// ── Config ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ConfigResponse {
    #[serde(rename = "wsUrl")]
    pub ws_url: String,
    pub network: String,
    pub version: String,
}

// ── Create Game ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateGameRequest {
    pub game_type: String,
    pub player1: String,
    pub stake_sompi: u64,
}

#[derive(Debug, Serialize)]
pub struct CreateGameResponse {
    pub id: String,
    pub game_type: String,
    pub status: String,
}

// ── Apply Move ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MoveRequest {
    pub player: u8,
    pub position: Option<usize>,
    pub column: Option<usize>,
    pub from: Option<[usize; 2]>,
    pub to: Option<[usize; 2]>,
    pub action: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MoveResponse {
    pub outcome: String,
    pub status: String,
}

// ── Settle Game ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SettleRequest {
    pub winner_address: String,
    pub escrow_tx: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SettleResponse {
    pub game_id: String,
    pub settle_tx: Option<String>,
    pub winner: String,
    pub status: String,
}

// ── Proof Preview ───────────────────────────────────────────

/// Request shape for /api/proof/preview — returns canonical proof commit JSON
#[derive(Debug, Deserialize)]
pub struct ProofPreviewRequest {
    pub match_id: String,
    pub winner: String,
    pub game_type: String,
    pub move_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ProofPreviewResponse {
    #[serde(rename = "canonicalShape")]
    pub canonical_shape: ProofPreviewShape,
}

#[derive(Debug, Serialize)]
pub struct ProofPreviewShape {
    pub protocol: String,
    #[serde(rename = "type")]
    pub proof_type: String,
    #[serde(rename = "matchId")]
    pub match_id: String,
    pub root: String, // SHA-256 hex placeholder
    pub winner: String,
    #[serde(rename = "moveCount")]
    pub move_count: usize,
    #[serde(rename = "gameType")]
    pub game_type: String,
    pub proof_system: String,
    pub note: String,
}

// ── Error ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_response_serializes() {
        let resp = HealthResponse {
            status: "ok".into(),
            engine: "rust".into(),
            version: "0.1.0".into(),
            uptime_secs: 3600,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"uptime_secs\":3600"));
    }

    #[test]
    fn create_game_deserializes() {
        let json = r#"{"game_type":"chess","player1":"kaspatest:abc","stake_sompi":100000000}"#;
        let req: CreateGameRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.game_type, "chess");
        assert_eq!(req.stake_sompi, 100_000_000);
    }

    #[test]
    fn proof_preview_shape_serializes() {
        let shape = ProofPreviewShape {
            protocol: "HTP/1.0".into(),
            proof_type: "narrow-verification".into(),
            match_id: "m1".into(),
            root: "sha256hexdigest...".into(),
            winner: "kaspatest:winner".into(),
            move_count: 42,
            game_type: "chess".into(),
            proof_system: "sha256-sequential-chain".into(),
            note: "Canonical shape — actual root computed by htpBuildMoveCommit".into(),
        };
        let json = serde_json::to_string_pretty(&shape).unwrap();
        assert!(json.contains("narrow-verification"));
        assert!(json.contains("kaspatest:winner"));
    }

    #[test]
    fn error_response_omits_optional_fields() {
        let err = ErrorResponse {
            error: "game not found".into(),
            field: None,
            reason: None,
        };
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, r#"{"error":"game not found"}"#);
    }
}
