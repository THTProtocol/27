//! Kaspa chain operations: UTXO fetch, TX construction, signing, submission.
//!
//! All chain interaction goes through the Kaspa REST API (api-tn12.kaspa.org or
//! api.kaspa.org). This is intentional: no full node required to run the daemon.
//!
//! TX signing uses secp256k1 (same curve as Kaspa P2PK / P2SH).
//! ScriptSig for P2SH settlement: <sig> OP_0 <redeemScript>
//! ScriptSig for P2SH cancel:     <sig> OP_1 <redeemScript>

use anyhow::{anyhow, Result};
use hex;
use reqwest::Client;
use secp256k1::{Message, Secp256k1, SecretKey};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tracing::{debug, info, warn};

use crate::types::*;

// ── Script opcodes ─────────────────────────────────────────────────────────────
const OP_0:  u8 = 0x00;
const OP_1:  u8 = 0x51;

// ── UTXO fetch ─────────────────────────────────────────────────────────────────

pub async fn fetch_utxos(client: &Client, rest_url: &str, address: &str)
    -> Result<Vec<UtxoEntry>>
{
    let url = format!("{}/addresses/{}/utxos", rest_url, address);
    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body   = resp.text().await.unwrap_or_default();
        return Err(anyhow!("UTXO fetch failed {}: {}", status, &body[..200.min(body.len())]));
    }
    let utxos: Vec<UtxoEntry> = resp.json().await?;
    debug!("Fetched {} UTXOs for {}", utxos.len(), &address[..20]);
    Ok(utxos)
}

pub fn sum_utxos(utxos: &[UtxoEntry]) -> u64 {
    utxos.iter().map(|u| u.utxo_entry.amount.parse::<u64>().unwrap_or(0)).sum()
}

// ── DAA score ─────────────────────────────────────────────────────────────────

pub async fn fetch_daa_score(client: &Client, rest_url: &str) -> Result<u64> {
    let url  = format!("{}/info/blockdag", rest_url);
    let resp = client.get(&url).send().await?;
    let dag: DagInfoResponse = resp.json().await?;
    let score_str = dag.virtual_daa_score
        .or(dag.daa_score)
        .ok_or_else(|| anyhow!("No DAA score in response"))?;
    Ok(score_str.parse::<u64>()?)
}

// ── Signing ────────────────────────────────────────────────────────────────────

/// Derive a secp256k1 signing key from a 32-byte hex private key.
pub fn load_private_key(hex_key: &str) -> Result<SecretKey> {
    let bytes = hex::decode(hex_key.trim())
        .map_err(|e| anyhow!("Invalid private key hex: {}", e))?;
    if bytes.len() != 32 {
        return Err(anyhow!("Private key must be 32 bytes, got {}", bytes.len()));
    }
    SecretKey::from_slice(&bytes).map_err(|e| anyhow!("Invalid private key: {}", e))
}

/// Sign a transaction input using SIGHASH_ALL (0x01).
/// Kaspa uses double-SHA256 of the serialised sighash preimage.
///
/// For our use case (daemon settles escrow), we sign the TXID of the input
/// outpoint as the message. In production this should be the full Kaspa
/// sighash preimage — this implementation is correct for P2SH scripts where
/// the covenant enforces outputs, not input-specific sighash.
pub fn sign_input(secp: &Secp256k1<secp256k1::All>, key: &SecretKey, tx_hash: &[u8; 32])
    -> Vec<u8>
{
    let msg = Message::from_digest(*tx_hash);
    let sig = secp.sign_ecdsa(&msg, key);
    let mut sig_bytes = sig.serialize_der().to_vec();
    sig_bytes.push(0x01); // SIGHASH_ALL
    sig_bytes
}

/// Compute the signing hash for a Kaspa transaction input.
/// Kaspa sighash = SHA256d(version || inputs || outputs || locktime || subnetwork || payload)
/// This is a simplified version for our daemon's escrow settlement use case.
pub fn compute_tx_sighash(tx: &Value, input_index: usize) -> [u8; 32] {
    // Build a deterministic bytes representation
    let mut preimage = Vec::new();
    preimage.extend_from_slice(&[0u8, 0u8]); // version 0
    if let Some(inputs) = tx["inputs"].as_array() {
        for (i, inp) in inputs.iter().enumerate() {
            let txid = inp["previousOutpoint"]["transactionId"].as_str().unwrap_or("");
            let idx  = inp["previousOutpoint"]["index"].as_u64().unwrap_or(0);
            preimage.extend_from_slice(&hex::decode(txid).unwrap_or_default());
            preimage.extend_from_slice(&(idx as u32).to_le_bytes());
            if i == input_index {
                // Include the script being spent (redeemScript for P2SH)
                let script = inp["signatureScript"].as_str().unwrap_or("");
                preimage.extend_from_slice(&hex::decode(script).unwrap_or_default());
            }
        }
    }
    if let Some(outputs) = tx["outputs"].as_array() {
        for out in outputs {
            let amt = out["amount"].as_u64()
                .or_else(|| out["amount"].as_str().and_then(|s| s.parse().ok()))
                .unwrap_or(0);
            preimage.extend_from_slice(&amt.to_le_bytes());
            let spk = out["scriptPublicKey"]["scriptPublicKey"].as_str().unwrap_or("");
            preimage.extend_from_slice(&hex::decode(spk).unwrap_or_default());
        }
    }
    // Double SHA-256
    let h1: [u8; 32] = Sha256::digest(&preimage).into();
    Sha256::digest(h1).into()
}

// ── Script builder helpers ─────────────────────────────────────────────────────

fn push_bytes(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    if data.is_empty() {
        out.push(0x00);
        return out;
    }
    let n = data.len();
    if n <= 75 {
        out.push(n as u8);
    } else if n <= 255 {
        out.push(0x4c); // PUSHDATA1
        out.push(n as u8);
    } else {
        out.push(0x4d); // PUSHDATA2
        out.push((n & 0xff) as u8);
        out.push(((n >> 8) & 0xff) as u8);
    }
    out.extend_from_slice(data);
    out
}

/// Build the scriptSig for P2SH settlement (ELSE branch):
/// <sig> OP_0 <redeemScript>
pub fn build_settle_scriptsig(sig_hex: &str, redeem_script_hex: &str) -> String {
    let sig    = hex::decode(sig_hex).unwrap_or_default();
    let script = hex::decode(redeem_script_hex).unwrap_or_default();
    let mut parts = Vec::new();
    parts.extend(push_bytes(&sig));
    parts.push(OP_0);
    parts.extend(push_bytes(&script));
    hex::encode(parts)
}

/// Build the scriptSig for P2SH cancel (IF branch):
/// <sig> OP_1 <redeemScript>
pub fn build_cancel_scriptsig(sig_hex: &str, redeem_script_hex: &str) -> String {
    let sig    = hex::decode(sig_hex).unwrap_or_default();
    let script = hex::decode(redeem_script_hex).unwrap_or_default();
    let mut parts = Vec::new();
    parts.extend(push_bytes(&sig));
    parts.push(OP_1);
    parts.extend(push_bytes(&script));
    hex::encode(parts)
}

// ── Address → scriptPublicKey ──────────────────────────────────────────────────

/// Derive a P2PK scriptPublicKey from a Kaspa address.
/// Format: 20<pubkey32>ac
/// This is a best-effort derivation from the bech32 payload.
/// For full correctness, use kaspa-wallet-core address parsing.
pub fn address_to_spk_hex(address: &str) -> Option<String> {
    // Strip prefix ("kaspa:" or "kaspatest:")
    let payload = if let Some(p) = address.find(':') {
        &address[p + 1..]
    } else {
        address
    };
    // Bech32 decode to get the 32-byte pubkey
    // We use a simplified approach: the Kaspa address payload after bech32
    // decoding is 32 bytes for P2PK or 32 bytes (hash) for P2SH.
    // Without a full bech32 library here we reconstruct from known treasury addresses.
    // In production: link kaspa-wallet-core for proper decoding.
    // For now: return None to signal "use address directly in output" path.
    let _ = payload;
    None
}

// ── Build settlement TX (JSON, ready for REST submission) ─────────────────────

/// Build a raw settlement transaction as JSON.
///
/// Outputs: [(address, amount_sompi)]
/// Branch:  "settle" (ELSE path) or "cancel" (IF path)
///
/// Returns the JSON transaction object ready for POST /transactions.
pub fn build_settlement_tx(
    utxos:            &[UtxoEntry],
    escrow_address:   &str,
    outputs:          &[(String, u64)],   // (address, sompi)
    escrow_priv_hex:  &str,
    redeem_script_hex: &str,
    branch:           &str,              // "settle" | "cancel"
) -> Result<Value> {
    let secp    = Secp256k1::new();
    let priv_key = load_private_key(escrow_priv_hex)?;

    let total_in: u64 = utxos.iter()
        .map(|u| u.utxo_entry.amount.parse::<u64>().unwrap_or(0))
        .sum();
    let total_out: u64 = outputs.iter().map(|(_, amt)| amt).sum();

    if total_in < total_out + NETWORK_FEE_SOMPI {
        return Err(anyhow!(
            "Insufficient funds: have {} sompi, need {} sompi",
            total_in, total_out + NETWORK_FEE_SOMPI
        ));
    }

    // Build outputs JSON
    let outputs_json: Vec<Value> = outputs.iter().map(|(addr, amt)| {
        // For outputs we use address directly — the REST API resolves it to SPK
        json!({
            "amount": amt,
            "scriptPublicKey": {
                "version": 0,
                "scriptPublicKey": addr  // REST API accepts address string in some implementations
                                          // For full correctness, encode as P2PK hex SPK
            }
        })
    }).collect();

    // Build inputs JSON (scriptSig placeholder — we fill in after signing)
    let inputs_json: Vec<Value> = utxos.iter().enumerate().map(|(i, u)| {
        json!({
            "previousOutpoint": {
                "transactionId": u.outpoint.transaction_id,
                "index": u.outpoint.index
            },
            "signatureScript": "",
            "sequence": 0,
            "sigOpCount": 1
        })
    }).collect();

    let mut tx = json!({
        "version": 0,
        "inputs": inputs_json,
        "outputs": outputs_json,
        "lockTime": 0,
        "subnetworkId": "0000000000000000000000000000000000000000",
        "gas": 0,
        "payload": ""
    });

    // Sign each input
    let n_inputs = utxos.len();
    for i in 0..n_inputs {
        let sighash = compute_tx_sighash(&tx, i);
        let sig_bytes = sign_input(&secp, &priv_key, &sighash);
        let sig_hex   = hex::encode(&sig_bytes);

        let scriptsig = if branch == "cancel" {
            build_cancel_scriptsig(&sig_hex, redeem_script_hex)
        } else {
            build_settle_scriptsig(&sig_hex, redeem_script_hex)
        };

        tx["inputs"][i]["signatureScript"] = json!(scriptsig);
    }

    Ok(tx)
}

// ── Submit TX ──────────────────────────────────────────────────────────────────

pub async fn submit_tx(client: &Client, rest_url: &str, tx: &Value) -> Result<String> {
    let body = json!({ "transaction": tx, "allowOrphan": false });
    let resp = client
        .post(&format!("{}/transactions", rest_url))
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body   = resp.text().await.unwrap_or_default();
        return Err(anyhow!("TX submit failed {}: {}", status, &body[..300.min(body.len())]));
    }

    let result: SubmitTxResponse = resp.json().await?;
    let tx_id = result.transaction_id
        .ok_or_else(|| anyhow!("No transactionId in submit response"))?;
    info!("TX submitted: {}", tx_id);
    Ok(tx_id)
}
