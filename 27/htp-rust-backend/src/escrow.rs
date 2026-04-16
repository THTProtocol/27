//! escrow.rs — KIP-10 P2SH Covenant Escrow: create, sign-payout, sign-cancel
//!
//! Kaspa uses Schnorr signatures over secp256k1.
//! The signature message is BLAKE2b-256 of the serialised transaction
//! (matching Kaspa's SigHash spec: version + inputs + outputs + locktime).
//!
//! Script paths:
//!   OP_IF   → cancel:     <creator_pubkey> OP_CHECKSIG
//!   OP_ELSE → settlement: <settlement_pubkey> OP_CHECKSIG
//!                         OP_TXOUTPUTCOUNT OP_2 OP_EQUAL
//!   OP_ENDIF

use anyhow::Result;
use blake2::{Blake2b, Digest};
use blake2::digest::consts::U32;
use sha2::{Sha256, Digest as Sha2Digest};
use secp256k1::{Secp256k1, SecretKey, Message};
use serde_json::json;
use crate::types::*;

const NETWORK_FEE_SOMPI: u64 = 10_000;

// Script opcodes (Kaspa / KIP-10 / KIP-17)
const OP_IF:            u8 = 0x63;
const OP_ELSE:          u8 = 0x67;
const OP_ENDIF:         u8 = 0x68;
const OP_CHECKSIG:      u8 = 0xAC;
const OP_TXOUTPUTCOUNT: u8 = 0xC1;
const OP_EQUAL:         u8 = 0x87;
const OP_2:             u8 = 0x52;
const OP_1:             u8 = 0x51; // push TRUE  (settlement branch selector)
const OP_0:             u8 = 0x00; // push FALSE (cancel branch selector)

fn push_bytes(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let n = data.len();
    if n == 0 {
        out.push(0x00);
    } else if n <= 75 {
        out.push(n as u8);
        out.extend_from_slice(data);
    } else if n <= 255 {
        out.push(0x4c);
        out.push(n as u8);
        out.extend_from_slice(data);
    } else {
        out.push(0x4d);
        out.push((n & 0xff) as u8);
        out.push(((n >> 8) & 0xff) as u8);
        out.extend_from_slice(data);
    }
    out
}

/// Kaspa SigHash: BLAKE2b-256 over the serialised transaction.
fn sighash(tx: &serde_json::Value) -> [u8; 32] {
    let preimage = serde_json::to_vec(tx).unwrap_or_default();
    let mut h = <Blake2b<U32>>::new();
    h.update(&preimage);
    h.finalize().into()
}

/// Sign a sighash with Schnorr (BIP-340 x-only keypair).
/// Uses only secp256k1::{Secp256k1, SecretKey, Message, Keypair} — no bitcoin-hashes feature needed.
fn schnorr_sign(secret_key_hex: &str, hash: &[u8; 32]) -> Result<String> {
    let secp = Secp256k1::new();
    let sk_bytes = hex::decode(secret_key_hex)
        .map_err(|_| anyhow::anyhow!("Invalid signing_key_hex: not valid hex"))?;
    if sk_bytes.len() != 32 {
        anyhow::bail!("signing_key_hex must be 32 bytes (64 hex chars)");
    }
    let sk = SecretKey::from_slice(&sk_bytes)
        .map_err(|e| anyhow::anyhow!("Bad secret key: {}", e))?;
    let keypair = secp256k1::Keypair::from_secret_key(&secp, &sk);
    let msg = Message::from_digest(*hash);
    let sig = secp.sign_schnorr(&msg, &keypair);
    Ok(hex::encode(sig.as_ref()))
}

/// scriptSig for settlement path (OP_ELSE): <sig> OP_1 <redeemScript>
fn settlement_script_sig(sig_hex: &str, redeem_script: &[u8]) -> String {
    let sig_bytes = hex::decode(sig_hex).unwrap_or_default();
    let mut s = Vec::new();
    s.extend(push_bytes(&sig_bytes));
    s.push(OP_1);
    s.extend(push_bytes(redeem_script));
    hex::encode(&s)
}

/// scriptSig for cancel path (OP_IF): <sig> OP_0 <redeemScript>
fn cancel_script_sig(sig_hex: &str, redeem_script: &[u8]) -> String {
    let sig_bytes = hex::decode(sig_hex).unwrap_or_default();
    let mut s = Vec::new();
    s.extend(push_bytes(&sig_bytes));
    s.push(OP_0);
    s.extend(push_bytes(redeem_script));
    hex::encode(&s)
}

/// Create a KIP-10 P2SH escrow address.
/// Returns address, script_hash, and redeem_script_hex.
/// redeem_script_hex MUST be stored — it is required for signing later.
pub fn create_escrow(req: &EscrowCreateRequest) -> Result<EscrowCreateResponse> {
    let network = req.network.as_deref().unwrap_or("testnet-12");
    let prefix  = if network.contains("main") { "kaspa" } else { "kaspatest" };

    let pubkey_a = hex::decode(&req.pubkey_a)
        .map_err(|_| anyhow::anyhow!("Invalid hex for pubkey_a"))?;
    let pubkey_b = hex::decode(&req.pubkey_b)
        .map_err(|_| anyhow::anyhow!("Invalid hex for pubkey_b"))?;

    // OP_IF <pubkey_a> OP_CHECKSIG
    // OP_ELSE <pubkey_b> OP_CHECKSIG OP_TXOUTPUTCOUNT OP_2 OP_EQUAL
    // OP_ENDIF
    let mut script = Vec::new();
    script.push(OP_IF);
    script.extend(push_bytes(&pubkey_a));
    script.push(OP_CHECKSIG);
    script.push(OP_ELSE);
    script.extend(push_bytes(&pubkey_b));
    script.push(OP_CHECKSIG);
    script.push(OP_TXOUTPUTCOUNT);
    script.push(OP_2);
    script.push(OP_EQUAL);
    script.push(OP_ENDIF);

    let mut hasher = <Blake2b<U32>>::new();
    hasher.update(&script);
    let script_hash       = hasher.finalize();
    let script_hash_hex   = hex::encode(&script_hash);
    let redeem_script_hex = hex::encode(&script);
    let escrow_address    = format!("{}:pq{}", prefix, &script_hash_hex[..40]);

    tracing::info!("[escrow] created {} redeem_script={}…", &escrow_address, &redeem_script_hex[..20]);

    Ok(EscrowCreateResponse { escrow_address, script_hash: script_hash_hex, redeem_script_hex })
}

/// Build + sign a payout TX (settlement path: OP_ELSE).
/// Output 0 → winner_address, Output 1 → treasury_address.
/// Returns signed=true when signing_key_hex + redeem_script_hex are provided.
pub fn build_payout(req: &EscrowPayoutRequest) -> Result<TxResponse> {
    let total: u64 = req.utxos.iter().map(|u| u.amount).sum();
    if total <= NETWORK_FEE_SOMPI {
        anyhow::bail!("Escrow balance too low: {} sompi", total);
    }
    let spendable     = total - NETWORK_FEE_SOMPI;
    let fee_amount    = (spendable as f64 * req.fee_bps as f64 / 10_000.0) as u64;
    let winner_amount = spendable.saturating_sub(fee_amount);

    tracing::info!("[escrow] payout total={} winner={} fee={}", total, winner_amount, fee_amount);

    let inputs: Vec<serde_json::Value> = req.utxos.iter().map(|u| json!({
        "previousOutpoint": { "transactionId": u.tx_id, "index": u.index },
        "signatureScript": "",
        "sequence": 0,
        "sigOpCount": 1
    })).collect();

    let outputs = vec![
        json!({ "amount": winner_amount, "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.winner_address } }),
        json!({ "amount": fee_amount,    "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.treasury_address } }),
    ];

    let mut tx = json!({
        "version": 0,
        "inputs": inputs,
        "outputs": outputs,
        "lockTime": 0,
        "subnetworkId": "0000000000000000000000000000000000000000",
        "gas": 0,
        "payload": ""
    });

    let tx_bytes = serde_json::to_vec(&tx)?;
    let h1: [u8; 32] = Sha256::digest(&tx_bytes).into();
    let h2 = Sha256::digest(h1);
    let tx_id = hex::encode(&h2[..32]);

    let signed = if let (Some(sk_hex), Some(rs_hex)) = (
        req.signing_key_hex.as_deref(),
        req.redeem_script_hex.as_deref(),
    ) {
        let hash       = sighash(&tx);
        let sig_hex    = schnorr_sign(sk_hex, &hash)?;
        let rs_bytes   = hex::decode(rs_hex)
            .map_err(|_| anyhow::anyhow!("Invalid redeem_script_hex"))?;
        let script_sig = settlement_script_sig(&sig_hex, &rs_bytes);
        if let Some(arr) = tx["inputs"].as_array_mut() {
            for inp in arr.iter_mut() { inp["signatureScript"] = json!(script_sig); }
        }
        tracing::info!("[escrow] payout TX signed (OP_ELSE)");
        true
    } else {
        tracing::warn!("[escrow] payout TX unsigned — signing_key_hex not provided");
        false
    };

    Ok(TxResponse { raw_tx: serde_json::to_string(&tx)?, tx_id, signed })
}

/// Build + sign a cancel TX (cancel path: OP_IF).
/// Output 0 → player_a (half), Output 1 → player_b (half).
pub fn build_cancel(req: &EscrowCancelRequest) -> Result<TxResponse> {
    let total: u64 = req.utxos.iter().map(|u| u.amount).sum();
    if total <= NETWORK_FEE_SOMPI {
        anyhow::bail!("Escrow balance too low: {} sompi", total);
    }
    let spendable = total - NETWORK_FEE_SOMPI;
    let half      = spendable / 2;

    tracing::info!("[escrow] cancel total={} each={}", total, half);

    let inputs: Vec<serde_json::Value> = req.utxos.iter().map(|u| json!({
        "previousOutpoint": { "transactionId": u.tx_id, "index": u.index },
        "signatureScript": "",
        "sequence": 0,
        "sigOpCount": 1
    })).collect();

    let outputs = vec![
        json!({ "amount": half,             "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.player_a_address } }),
        json!({ "amount": spendable - half, "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.player_b_address } }),
    ];

    let mut tx = json!({
        "version": 0,
        "inputs": inputs,
        "outputs": outputs,
        "lockTime": 0,
        "subnetworkId": "0000000000000000000000000000000000000000",
        "gas": 0,
        "payload": ""
    });

    let tx_bytes = serde_json::to_vec(&tx)?;
    let h1: [u8; 32] = Sha256::digest(&tx_bytes).into();
    let h2 = Sha256::digest(h1);
    let tx_id = hex::encode(&h2[..32]);

    let signed = if let (Some(sk_hex), Some(rs_hex)) = (
        req.signing_key_hex.as_deref(),
        req.redeem_script_hex.as_deref(),
    ) {
        let hash       = sighash(&tx);
        let sig_hex    = schnorr_sign(sk_hex, &hash)?;
        let rs_bytes   = hex::decode(rs_hex)
            .map_err(|_| anyhow::anyhow!("Invalid redeem_script_hex"))?;
        let script_sig = cancel_script_sig(&sig_hex, &rs_bytes);
        if let Some(arr) = tx["inputs"].as_array_mut() {
            for inp in arr.iter_mut() { inp["signatureScript"] = json!(script_sig); }
        }
        tracing::info!("[escrow] cancel TX signed (OP_IF)");
        true
    } else {
        tracing::warn!("[escrow] cancel TX unsigned — signing_key_hex not provided");
        false
    };

    Ok(TxResponse { raw_tx: serde_json::to_string(&tx)?, tx_id, signed })
}
