use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct SettlementRequest {
    pub event_id: String,
    pub settlement_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub winner: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub home_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub away_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub players_rank: Option<Vec<String>>,
    pub timestamp: String,
    pub signature: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SettlementResponse {
    pub success: bool,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub txid: Option<String>,
}
