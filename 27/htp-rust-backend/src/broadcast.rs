use anyhow::Result;
use crate::types::*;

/// Broadcast a raw transaction to the Kaspa network via REST API.
///
/// TODO: Use the Kaspa RPC client for direct broadcast instead of REST.
/// The REST API may not support raw transaction submission directly.
pub async fn broadcast_tx(req: &BroadcastRequest, api_base: &str) -> Result<BroadcastResponse> {
    let client = reqwest::Client::new();

    // TODO: The actual broadcast endpoint may differ.
    // Kaspa REST API uses POST /transactions with the raw tx payload.
    let url = format!("{}/transactions", api_base);

    let resp = client.post(&url)
        .header("Content-Type", "application/json")
        .body(req.raw_tx.clone())
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("Broadcast failed ({}): {}", status, body);
    }

    let body: serde_json::Value = resp.json().await?;
    let tx_id = body.get("transactionId")
        .or_else(|| body.get("txId"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(BroadcastResponse { tx_id })
}
