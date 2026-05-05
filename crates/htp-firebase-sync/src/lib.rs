//! HTP Firebase Sync Bridge
//! Writes match outcomes to Firebase Realtime Database.
//! Reads active matches for lobby sync.

use reqwest::Client;
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct FirebaseSync {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl FirebaseSync {
    pub fn new(base_url: String, token: Option<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
        }
    }

    fn auth_param(&self) -> String {
        match &self.token {
            Some(t) => format!("?auth={}", t),
            None => String::new(),
        }
    }

    /// Write match outcome to Firebase.
    /// PATCH /matches/{match_id}.json
    pub async fn write_match_outcome(
        &self,
        match_id: &str,
        winner: &str,
        settle_tx: &str,
    ) -> Result<(), String> {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let body = json!({
            "status": "settled",
            "winner": winner,
            "settle_tx": settle_tx,
            "settled_at": now_ms,
        });

        let url = format!(
            "{}/matches/{}.json{}",
            self.base_url, match_id, self.auth_param()
        );

        let resp = self.client
            .patch(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Firebase write error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Firebase HTTP {}: {}", status, text));
        }

        tracing::info!(
            "[FirebaseSync] Wrote match={} winner={} tx={}",
            match_id, winner, settle_tx
        );
        Ok(())
    }

    /// Get active matches from Firebase.
    /// GET /matches.json?orderBy="status"&equalTo="active"
    pub async fn get_active_matches(&self) -> Result<Vec<(String, Value)>, String> {
        let url = format!(
            "{}/matches.json{}&orderBy=%22status%22&equalTo=%22active%22",
            self.base_url,
            self.auth_param().replace('?', if self.token.is_some() { "?" } else { "?" })
        );

        // Rebuild URL properly
        let url = if self.token.is_some() {
            format!(
                "{}/matches.json?auth={}&orderBy=%22status%22&equalTo=%22active%22",
                self.base_url, self.token.as_ref().unwrap()
            )
        } else {
            format!(
                "{}/matches.json?orderBy=%22status%22&equalTo=%22active%22",
                self.base_url
            )
        };

        let resp = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Firebase read error: {}", e))?;

        let data: Value = resp
            .json()
            .await
            .map_err(|e| format!("Firebase parse error: {}", e))?;

        let mut matches = Vec::new();
        if let Some(obj) = data.as_object() {
            for (k, v) in obj {
                matches.push((k.clone(), v.clone()));
            }
        }

        tracing::debug!("[FirebaseSync] Found {} active matches", matches.len());
        Ok(matches)
    }
}
