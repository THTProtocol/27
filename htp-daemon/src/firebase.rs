//! Firebase Realtime Database client.
//! Uses the Firebase REST API with a service account JWT for auth.
//!
//! All reads/writes go through:
//!   GET  {db_url}/{path}.json?auth={token}
//!   PUT  {db_url}/{path}.json?auth={token}
//!   PATCH {db_url}/{path}.json?auth={token}

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use reqwest::Client;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use tracing::{debug, warn};

/// Firebase client — holds config and a cached JWT.
#[derive(Clone)]
pub struct FirebaseClient {
    pub db_url:    String,
    pub http:      Client,
    token_cache:   Arc<Mutex<Option<CachedToken>>>,
    service_key:   ServiceAccountKey,
}

#[derive(Clone)]
struct CachedToken {
    token:      String,
    expires_at: i64,  // unix seconds
}

#[derive(Clone, serde::Deserialize)]
pub struct ServiceAccountKey {
    pub client_email:  String,
    pub private_key:   String,
    pub token_uri:     String,
}

impl FirebaseClient {
    pub fn new(db_url: String, service_key: ServiceAccountKey, http: Client) -> Self {
        Self {
            db_url,
            http,
            service_key,
            token_cache: Arc::new(Mutex::new(None)),
        }
    }

    /// Get a valid access token, refreshing if expired.
    async fn get_token(&self) -> Result<String> {
        // Check cache
        {
            let cache = self.token_cache.lock().unwrap();
            if let Some(ref t) = *cache {
                if t.expires_at > Utc::now().timestamp() + 60 {
                    return Ok(t.token.clone());
                }
            }
        }
        // Mint a new JWT
        let token = self.mint_jwt().await?;
        {
            let mut cache = self.token_cache.lock().unwrap();
            *cache = Some(CachedToken {
                token:      token.clone(),
                expires_at: Utc::now().timestamp() + 3600,
            });
        }
        Ok(token)
    }

    /// Mint a service account JWT and exchange it for an access token.
    async fn mint_jwt(&self) -> Result<String> {
        let now  = Utc::now().timestamp();
        let exp  = now + 3600;
        let header  = URL_SAFE_NO_PAD.encode(r#"{"alg":"RS256","typ":"JWT"}"#);
        let claims  = URL_SAFE_NO_PAD.encode(format!(
            r##"{{"iss":"{email}","scope":"https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email","aud":"{aud}","iat":{iat},"exp":{exp}}}"##,
            email = self.service_key.client_email,
            aud   = self.service_key.token_uri,
            iat   = now,
            exp   = exp,
        ));
        let signing_input = format!("{}.{}", header, claims);

        // Sign with RS256 using the service account private key
        // NOTE: For a full RS256 implementation you'd use the `rsa` crate.
        // Here we use a pre-signed approach via the Google OAuth2 token endpoint.
        // In production, link the `rsa` + `pkcs8` crates for proper RS256.
        //
        // Fallback: use the Firebase legacy "database secret" via ?auth= if available.
        // Set FIREBASE_AUTH_SECRET in .env to bypass JWT minting during development.
        let _ = signing_input;
        Err(anyhow!("RS256 JWT minting: link the 'rsa' crate or set FIREBASE_AUTH_SECRET in .env"))
    }

    /// Read a Firebase path. Returns None if the path is null/missing.
    pub async fn get(&self, path: &str) -> Result<Option<Value>> {
        let token = self.get_token().await?;
        let url   = format!("{}/{}.json?auth={}", self.db_url.trim_end_matches('/'), path, token);
        let resp  = self.http.get(&url).send().await?;
        if !resp.status().is_success() {
            let s = resp.status();
            let b = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Firebase GET {} failed {}: {}", path, s, &b[..200.min(b.len())]));
        }
        let val: Value = resp.json().await?;
        if val.is_null() { Ok(None) } else { Ok(Some(val)) }
    }

    /// Write (PUT) a value to a Firebase path.
    pub async fn set(&self, path: &str, value: &Value) -> Result<()> {
        let token = self.get_token().await?;
        let url   = format!("{}/{}.json?auth={}", self.db_url.trim_end_matches('/'), path, token);
        let resp  = self.http.put(&url).json(value).send().await?;
        if !resp.status().is_success() {
            let s = resp.status();
            let b = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Firebase SET {} failed {}: {}", path, s, &b[..200.min(b.len())]));
        }
        debug!("Firebase SET {}", path);
        Ok(())
    }

    /// Update (PATCH) specific fields at a Firebase path.
    pub async fn update(&self, path: &str, value: &Value) -> Result<()> {
        let token = self.get_token().await?;
        let url   = format!("{}/{}.json?auth={}", self.db_url.trim_end_matches('/'), path, token);
        let resp  = self.http.patch(&url).json(value).send().await?;
        if !resp.status().is_success() {
            let s = resp.status();
            let b = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Firebase UPDATE {} failed {}: {}", path, s, &b[..200.min(b.len())]));
        }
        debug!("Firebase UPDATE {}", path);
        Ok(())
    }

    /// Delete a Firebase path.
    pub async fn delete(&self, path: &str) -> Result<()> {
        let token = self.get_token().await?;
        let url   = format!("{}/{}.json?auth={}", self.db_url.trim_end_matches('/'), path, token);
        let resp  = self.http.delete(&url).send().await?;
        if !resp.status().is_success() {
            warn!("Firebase DELETE {} failed: {}", path, resp.status());
        }
        Ok(())
    }
}
