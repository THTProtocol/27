//! HTP Kaspa REST RPC Client — port of lib/kaspa-rpc.js
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum RpcError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, RpcError>;

#[derive(Debug, Clone)]
pub struct KaspaRpc {
    client: Client,
    pub rest_url: String,
}

#[derive(Debug, Deserialize)]
pub struct AddressBalance {
    pub address: String,
    pub balance: i64,
}

#[derive(Debug, Deserialize)]
pub struct UtxoEntry {
    pub amount: i64,
    pub script_public_key: ScriptPublicKey,
    pub block_daa_score: i64,
    pub is_coinbase: bool,
}

#[derive(Debug, Deserialize)]
pub struct ScriptPublicKey {
    #[serde(rename = "scriptPublicKey")]
    pub script: String,
    pub version: Option<u16>,
}

#[derive(Debug, Deserialize)]
pub struct Utxo {
    pub outpoint: Outpoint,
    #[serde(rename = "utxoEntry")]
    pub entry: UtxoEntry,
}

#[derive(Debug, Deserialize)]
pub struct Outpoint {
    pub transaction_id: String,
    pub index: u32,
}

#[derive(Debug, Deserialize)]
pub struct BlockDagInfo {
    pub virtual_daa_score: Option<String>,
    #[serde(rename = "virtualDaaScore")]
    pub virtual_daa_score_alt: Option<String>,
    pub block_count: Option<u64>,
    pub network_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TxSubmission {
    pub transaction: serde_json::Value,
    #[serde(rename = "allowOrphan")]
    pub allow_orphan: bool,
}

#[derive(Debug, Deserialize)]
pub struct TxResult {
    #[serde(rename = "transactionId")]
    pub transaction_id: Option<String>,
    pub txid: Option<String>,
}

impl KaspaRpc {
    pub fn new(rest_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        Self { client, rest_url }
    }

    pub fn with_client(rest_url: String, client: Client) -> Self {
        Self { client, rest_url }
    }

    pub async fn get_balance(&self, address: &str) -> Result<AddressBalance> {
        let url = format!("{}/addresses/{}/balance", self.rest_url, address);
        let resp = self.client.get(&url).send().await?;
        let bal: AddressBalance = resp.json().await?;
        Ok(bal)
    }

    pub async fn get_utxos(&self, address: &str) -> Result<Vec<Utxo>> {
        let url = format!("{}/addresses/{}/utxos", self.rest_url, address);
        let resp = self.client.get(&url).send().await?;
        let utxos: Vec<Utxo> = resp.json().await?;
        Ok(utxos)
    }

    pub async fn get_blockdag_info(&self) -> Result<BlockDagInfo> {
        let url = format!("{}/info/blockdag", self.rest_url);
        let resp = self.client.get(&url).send().await?;
        let info: BlockDagInfo = resp.json().await?;
        Ok(info)
    }

    pub async fn submit_transaction(&self, tx: serde_json::Value) -> Result<String> {
        let url = format!("{}/transactions", self.rest_url);
        let body = TxSubmission {
            transaction: tx,
            allow_orphan: true,
        };
        let resp = self.client.post(&url).json(&body).send().await?;
        let result: TxResult = resp.json().await?;
        Ok(result.transaction_id.or(result.txid).unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_client() {
        let rpc = KaspaRpc::new("https://api-tn12.kaspa.org".into());
        assert_eq!(rpc.rest_url, "https://api-tn12.kaspa.org");
    }
}
