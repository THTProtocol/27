//! MiroFish Bridge - Image generation client for High Table Protocol
//! 
//! Provides auto-fallback between primary and secondary MiroFish instances.

use reqwest::Client;
use serde_json::Value;
use thiserror::Error;
use tracing::{debug, info, warn};

/// Error types for MiroFish client operations
#[derive(Error, Debug)]
pub enum MiroFishError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    
    #[error("JSON serialization failed: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("Both primary and fallback URLs failed")]
    AllEndpointsFailed,
    
    #[error("Invalid response from server")]
    InvalidResponse,
}

pub type Result<T> = std::result::Result<T, MiroFishError>;

/// Tournament bracket structure for image generation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TournamentBracket {
    pub tournament_id: String,
    pub tournament_name: String,
    pub players: Vec<BracketPlayer>,
    pub matches: Vec<BracketMatch>,
    pub status: BracketStatus,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BracketPlayer {
    pub player_id: String,
    pub pubkey: String,
    pub name: String,
    pub seed: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BracketMatch {
    pub match_id: String,
    pub round: u32,
    pub player1: Option<String>,
    pub player2: Option<String>,
    pub winner: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BracketStatus {
    Pending,
    InProgress,
    Completed,
}

/// MiroFish client with automatic fallback support
pub struct MiroFishClient {
    base_url: String,      // http://localhost:5001
    fallback_url: String,  // http://localhost:3002
    client: Client,
}

impl MiroFishClient {
    /// Create a new MiroFish client with primary and fallback URLs
    pub fn new(base_url: &str, fallback_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            fallback_url: fallback_url.to_string(),
            client: Client::new(),
        }
    }

    /// Create a new MiroFish client with default URLs
    pub fn with_defaults() -> Self {
        Self::new("http://localhost:5001", "http://localhost:3002")
    }

    /// Generate a chess board image from FEN notation
    pub async fn generate_board_image(&self, fen: &str, game_type: &str) -> Result<Vec<u8>> {
        info!("Generating board image for game_type: {}", game_type);
        
        let body = serde_json::json!({
            "fen": fen,
            "game_type": game_type,
        });

        self.post("/api/v1/board", body).await
    }

    /// Generate a tournament bracket image
    pub async fn generate_tournament_bracket(&self, bracket: &TournamentBracket) -> Result<Vec<u8>> {
        info!("Generating tournament bracket: {}", bracket.tournament_name);
        
        let body = serde_json::to_value(bracket)?;
        self.post("/api/v1/bracket", body).await
    }

    /// Generate a player avatar from public key
    pub async fn generate_player_avatar(&self, pubkey: &str) -> Result<Vec<u8>> {
        info!("Generating avatar for pubkey: {}", pubkey);
        
        let body = serde_json::json!({
            "pubkey": pubkey,
        });

        self.post("/api/v1/avatar", body).await
    }

    /// Internal POST method with auto-fallback logic
    async fn post(&self, endpoint: &str, body: Value) -> Result<Vec<u8>> {
        // Try primary endpoint first
        match self.post_to_endpoint(&self.base_url, endpoint, &body).await {
            Ok(result) => {
                debug!("Primary endpoint succeeded: {}", self.base_url);
                return Ok(result);
            }
            Err(e) => {
                warn!("Primary endpoint failed ({}): {}, trying fallback", self.base_url, e);
            }
        }

        // Fall back to secondary endpoint
        match self.post_to_endpoint(&self.fallback_url, endpoint, &body).await {
            Ok(result) => {
                debug!("Fallback endpoint succeeded: {}", self.fallback_url);
                Ok(result)
            }
            Err(e) => {
                warn!("Fallback endpoint also failed ({}): {}", self.fallback_url, e);
                Err(MiroFishError::AllEndpointsFailed)
            }
        }
    }

    /// POST to a specific endpoint
    async fn post_to_endpoint(&self, base: &str, endpoint: &str, body: &Value) -> Result<Vec<u8>> {
        let url = format!("{}{}", base, endpoint);
        
        let response = self.client
            .post(&url)
            .json(body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(MiroFishError::HttpError(
                reqwest::Error::from(reqwest::StatusCode::from_u16(response.status().as_u16()).unwrap())
            ));
        }

        let bytes = response.bytes().await?;
        Ok(bytes.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = MiroFishClient::with_defaults();
        assert_eq!(client.base_url, "http://localhost:5001");
        assert_eq!(client.fallback_url, "http://localhost:3002");
    }

    #[test]
    fn test_custom_urls() {
        let client = MiroFishClient::new("http://custom:5001", "http://backup:3002");
        assert_eq!(client.base_url, "http://custom:5001");
        assert_eq!(client.fallback_url, "http://backup:3002");
    }
}
