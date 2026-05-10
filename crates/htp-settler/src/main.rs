use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{error, info, warn};

const POLL_INTERVAL_SECONDS: u64 = 30;
const SETTLEMENT_TIMEOUT_SECONDS: u64 = 300; // 5 min timeout for settlement

#[derive(Debug, Deserialize, Clone)]
struct Event {
    id: String,
    event_type: String,
    #[serde(default, rename = "final")]
    final_: bool,
    #[serde(default)]
    settled: bool,
    #[serde(default)]
    skill_game: bool,
    #[serde(default)]
    winner: Option<String>,
    #[serde(default)]
    home_score: Option<i32>,
    #[serde(default)]
    away_score: Option<i32>,
    #[serde(default)]
    result: Option<String>,
    #[serde(default)]
    players: Option<Vec<String>>,
    #[serde(default)]
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct SettlementRequest {
    event_id: String,
    settlement_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    winner: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    home_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    away_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    players_rank: Option<Vec<String>>,
    timestamp: String,
    signature: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EventsResponse {
    events: Vec<Event>,
    #[serde(default)]
    count: usize,
}

#[derive(Debug, Deserialize)]
struct SettlementResponse {
    success: bool,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    txid: Option<String>,
}

struct SettlerConfig {
    api_base_url: String,
    settlement_key: Option<String>,
}

impl SettlerConfig {
    fn from_env() -> Self {
        let api_base_url = std::env::var("HTP_API_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let settlement_key = std::env::var("HTP_SETTLEMENT_KEY").ok();
        
        Self {
            api_base_url,
            settlement_key,
        }
    }
}

struct SettlerDaemon {
    client: Client,
    config: SettlerConfig,
}

impl SettlerDaemon {
    fn new(config: SettlerConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(SETTLEMENT_TIMEOUT_SECONDS))
            .build()
            .expect("Failed to create HTTP client");
        
        Self { client, config }
    }

    async fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("HTP Auto-Settlement Daemon started");
        info!("API base URL: {}", self.config.api_base_url);
        info!("Polling interval: {} seconds", POLL_INTERVAL_SECONDS);

        let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_SECONDS));

        loop {
            interval.tick().await;
            
            if let Err(e) = self.process_settlements().await {
                error!("Error during settlement processing: {}", e);
            }
        }
    }

    async fn process_settlements(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let events = self.fetch_pending_final_events().await?;
        
        if events.is_empty() {
            return Ok(());
        }

        info!("Found {} final events pending settlement", events.len());

        for event in events {
            if let Err(e) = self.settle_event(&event).await {
                error!("Failed to settle event {}: {}", event.id, e);
            }
        }

        Ok(())
    }

    async fn fetch_pending_final_events(&self) -> Result<Vec<Event>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/events?final=true&settled=false", self.config.api_base_url);
        
        let mut request = self.client.get(&url);
        
        if let Some(ref key) = self.config.settlement_key {
            request = request.header("X-Settlement-Key", key);
        }

        let response = request.send().await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("API error: {} - {}", status, text).into());
        }

        let data: EventsResponse = response.json().await?;
        Ok(data.events)
    }

    async fn settle_event(&self, event: &Event) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Processing settlement for event {} (type: {}, skill_game: {})", 
              event.id, event.event_type, event.skill_game);

        let settlement_req = if event.skill_game {
            self.build_skill_game_settlement(event)?
        } else {
            self.build_standard_settlement(event)?
        };

        self.submit_settlement(&settlement_req).await?;
        
        info!("Successfully settled event {}", event.id);
        Ok(())
    }

    fn build_standard_settlement(&self, event: &Event) -> Result<SettlementRequest, Box<dyn std::error::Error + Send + Sync>> {
        let winner = event.winner.clone()
            .ok_or_else(|| format!("Event {} missing winner", event.id))?;

        Ok(SettlementRequest {
            event_id: event.id.clone(),
            settlement_type: "standard".to_string(),
            winner: Some(winner),
            home_score: event.home_score,
            away_score: event.away_score,
            result: event.result.clone(),
            players_rank: None,
            timestamp: Utc::now().to_rfc3339(),
            signature: None,
        })
    }

    fn build_skill_game_settlement(&self, event: &Event) -> Result<SettlementRequest, Box<dyn std::error::Error + Send + Sync>> {
        let players = event.players.clone()
            .ok_or_else(|| format!("Skill game event {} missing players", event.id))?;
        
        let result = event.result.clone()
            .ok_or_else(|| format!("Skill game event {} missing result", event.id))?;

        // Rank players based on metadata if available
        let players_rank = if let Some(ref metadata) = event.metadata {
            metadata.get("ranking")
                .and_then(|r| r.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_else(|| players.clone())
        } else {
            players.clone()
        };

        let winner = players_rank.first().cloned()
            .ok_or_else(|| format!("Skill game event {} has empty players list", event.id))?;

        Ok(SettlementRequest {
            event_id: event.id.clone(),
            settlement_type: "skill_game".to_string(),
            winner: Some(winner),
            home_score: event.home_score,
            away_score: event.away_score,
            result: Some(result),
            players_rank: Some(players_rank),
            timestamp: Utc::now().to_rfc3339(),
            signature: None,
        })
    }

    async fn submit_settlement(&self, req: &SettlementRequest) -> Result<SettlementResponse, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/events/{}/settle", self.config.api_base_url, req.event_id);
        
        let mut request = self.client.post(&url).json(req);
        
        if let Some(ref key) = self.config.settlement_key {
            request = request.header("X-Settlement-Key", key);
        }

        let response = request.send().await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Settlement API error: {} - {}", status, text).into());
        }

        let data: SettlementResponse = response.json().await?;
        
        if !data.success {
            return Err(format!("Settlement failed: {:?}", data.message).into());
        }

        Ok(data)
    }
}

fn init_logging() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(true)
        .with_thread_ids(true)
        .init();
}

#[tokio::main]
async fn main() {
    init_logging();

    let config = SettlerConfig::from_env();
    let daemon = SettlerDaemon::new(config);

    info!("Starting HTP Auto-Settlement Daemon...");

    if let Err(e) = daemon.run().await {
        error!("Daemon error: {}", e);
        std::process::exit(1);
    }
}
