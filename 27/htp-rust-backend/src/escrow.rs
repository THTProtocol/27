//! escrow.rs — KIP-10 P2SH Covenant Escrow: create, sign-payout, sign-cancel
//!
//! Fixes v2:
//!   - Escrow address uses proper kaspa bech32m encoding (not truncated hash)
//!   - build_cancel now deducts 1% draw protocol fee to treasury

use anyhow::Result;
use blake2::{Blake2b, Digest};
use blake2::digest::consts::U32;
use sha2::{Sha256, Digest as Sha2Digest};
use secp256k1::{Secp256k1, SecretKey, Message};
use serde_json::json;
use crate::types::*;
use crate::fee::{NETWORK_FEE_SOMPI, DRAW_FEE_PCT, treasury_address};

const OP_IF:            u8 = 0x63;
const OP_ELSE:          u8 = 0x67;
const OP_ENDIF:         u8 = 0x68;
const OP_CHECKSIG:      u8 = 0xAC;
const OP_TXOUTPUTCOUNT: u8 = 0xC1;
const OP_EQUAL:         u8 = 0x87;
const OP_2:             u8 = 0x52;
const OP_1:             u8 = 0x51;
const OP_0:             u8 = 0x00;

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

/// Bech32m charset
const CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/// Polymod for bech32m checksum
fn bech32m_polymod(values: &[u8]) -> u64 {
    let gen: [u64; 5] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let mut chk: u64 = 1;
    for &v in values {
        let b = (chk >> 25) as u8;
        chk = ((chk & 0x1fff_ffff) << 5) ^ (v as u64);
        for (i, &g) in gen.iter().enumerate() {
            if (b >> i) & 1 == 1 { chk ^= g; }
        }
    }
    chk
}

/// Encode 32-byte hash as kaspa p2sh bech32m address.
/// Kaspa P2SH scriptPubKey version byte = 0x08, then 32-byte hash.
fn kaspa_p2sh_address(prefix: &str, script_hash: &[u8; 32]) -> String {
    // version byte 0x08 = P2SH in kaspa
    let mut payload = vec![0x08u8];
    payload.extend_from_slice(script_hash);

    // convert to 5-bit groups
    let mut data5: Vec<u8> = Vec::new();
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for &byte in &payload {
        acc = (acc << 8) | byte as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            data5.push(((acc >> bits) & 0x1f) as u8);
        }
    }
    if bits > 0 { data5.push(((acc << (5 - bits)) & 0x1f) as u8); }

    // checksum
    let hrp_bytes: Vec<u8> = prefix.bytes().map(|b| b & 0x1f).collect();
    let mut enc: Vec<u8> = hrp_bytes.clone();
    enc.push(0);
    enc.extend_from_slice(&data5);
    enc.extend_from_slice(&[0u8; 8]);
    let pmod = bech32m_polymod(&enc) ^ 0x2bc830a3; // bech32m constant
    let mut checksum = [0u8; 8];
    for i in 0..8 { checksum[i] = ((pmod >> (5 * (7 - i))) & 0x1f) as u8; }

    let mut chars: String = prefix.to_string();
    chars.push(':');
    for &d in data5.iter().chain(checksum.iter()) {
        chars.push(CHARSET[d as usize] as char);
    }
    chars
}

fn sighash(tx: &serde_json::Value) -> [u8; 32] {
    let preimage = serde_json::to_vec(tx).unwrap_or_default();
    let mut h = <Blake2b<U32>>::new();
    h.update(&preimage);
    h.finalize().into()
}

fn schnorr_sign(secret_key_hex: &str, hash: &[u8; 32]) -> Result<String> {
    let secp = Secp256k1::new();
    let sk_bytes = hex::decode(secret_key_hex)
        .map_err(|_| anyhow::anyhow!("Invalid signing_key_hex: not valid hex"))?;
    if sk_bytes.len() != 32 { anyhow::bail!("signing_key_hex must be 32 bytes (64 hex chars)"); }
    let sk      = SecretKey::from_slice(&sk_bytes).map_err(|e| anyhow::anyhow!("Bad secret key: {}", e))?;
    let keypair = secp256k1::Keypair::from_secret_key(&secp, &sk);
    let msg     = Message::from_digest(*hash);
    let sig     = secp.sign_schnorr_with_rng(&msg, &keypair, &mut rand::thread_rng());
    Ok(hex::encode(sig.as_ref()))
}

fn settlement_script_sig(sig_hex: &str, redeem_script: &[u8]) -> String {
    let sig_bytes = hex::decode(sig_hex).unwrap_or_default();
    let mut s = Vec::new();
    s.extend(push_bytes(&sig_bytes));
    s.push(OP_1);
    s.extend(push_bytes(redeem_script));
    hex::encode(&s)
}

fn cancel_script_sig(sig_hex: &str, redeem_script: &[u8]) -> String {
    let sig_bytes = hex::decode(sig_hex).unwrap_or_default();
    let mut s = Vec::new();
    s.extend(push_bytes(&sig_bytes));
    s.push(OP_0);
    s.extend(push_bytes(redeem_script));
    hex::encode(&s)
}

pub fn create_escrow(req: &EscrowCreateRequest) -> Result<EscrowCreateResponse> {
    let network = req.network.as_deref().unwrap_or("testnet-12");
    let prefix  = if network.contains("main") { "kaspa" } else { "kaspatest" };

    let pubkey_a = hex::decode(&req.pubkey_a)
        .map_err(|_| anyhow::anyhow!("Invalid hex for pubkey_a"))?;
    let pubkey_b = hex::decode(&req.pubkey_b)
        .map_err(|_| anyhow::anyhow!("Invalid hex for pubkey_b"))?;

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
    let script_hash_bytes: [u8; 32] = hasher.finalize().into();
    let script_hash_hex   = hex::encode(&script_hash_bytes);
    let redeem_script_hex = hex::encode(&script);

    // Proper bech32m P2SH address
    let escrow_address = kaspa_p2sh_address(prefix, &script_hash_bytes);

    tracing::info!("[escrow] created {} redeem_script={}\u{2026}", &escrow_address, &redeem_script_hex[..20]);

    Ok(EscrowCreateResponse { escrow_address, script_hash: script_hash_hex, redeem_script_hex })
}

pub fn build_payout(req: &EscrowPayoutRequest) -> Result<TxResponse> {
    let total: u64 = req.utxos.iter().map(|u| u.amount).sum();
    if total <= NETWORK_FEE_SOMPI { anyhow::bail!("Escrow balance too low: {} sompi", total); }
    let spendable     = total - NETWORK_FEE_SOMPI;
    let fee_amount    = (spendable as f64 * req.fee_bps as f64 / 10_000.0) as u64;
    let winner_amount = spendable.saturating_sub(fee_amount);

    tracing::info!("[escrow] payout total={} winner={} fee={}", total, winner_amount, fee_amount);

    let inputs: Vec<serde_json::Value> = req.utxos.iter().map(|u| json!({
        "previousOutpoint": { "transactionId": u.tx_id, "index": u.index },
        "signatureScript": "", "sequence": 0, "sigOpCount": 1
    })).collect();

    let outputs = vec![
        json!({ "amount": winner_amount, "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.winner_address } }),
        json!({ "amount": fee_amount,    "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.treasury_address } }),
    ];

    let mut tx = json!({
        "version": 0, "inputs": inputs, "outputs": outputs,
        "lockTime": 0, "subnetworkId": "0000000000000000000000000000000000000000",
        "gas": 0, "payload": ""
    });

    let tx_bytes = serde_json::to_vec(&tx)?;
    let h1: [u8; 32] = Sha256::digest(&tx_bytes).into();
    let h2  = Sha256::digest(h1);
    let tx_id = hex::encode(&h2[..32]);

    let signed = if let (Some(sk_hex), Some(rs_hex)) = (
        req.signing_key_hex.as_deref(),
        req.redeem_script_hex.as_deref(),
    ) {
        let hash       = sighash(&tx);
        let sig_hex    = schnorr_sign(sk_hex, &hash)?;
        let rs_bytes   = hex::decode(rs_hex).map_err(|_| anyhow::anyhow!("Invalid redeem_script_hex"))?;
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

pub fn build_cancel(req: &EscrowCancelRequest) -> Result<TxResponse> {
    let total: u64 = req.utxos.iter().map(|u| u.amount).sum();
    if total <= NETWORK_FEE_SOMPI { anyhow::bail!("Escrow balance too low: {} sompi", total); }
    let spendable = total - NETWORK_FEE_SOMPI;

    // 1% draw protocol fee per player (total 2% of pool)
    let network       = req.network.as_deref().unwrap_or("testnet-12");
    let treasury_addr = treasury_address(network);
    let fee_each      = (spendable as f64 * DRAW_FEE_PCT / 2.0) as u64;  // 0.5% of spendable each
    let refund_each   = (spendable / 2).saturating_sub(fee_each);
    let treasury_amt  = spendable.saturating_sub(refund_each * 2);

    tracing::info!("[escrow] cancel total={} refund_each={} treasury={}", total, refund_each, treasury_amt);

    let inputs: Vec<serde_json::Value> = req.utxos.iter().map(|u| json!({
        "previousOutpoint": { "transactionId": u.tx_id, "index": u.index },
        "signatureScript": "", "sequence": 0, "sigOpCount": 1
    })).collect();

    let mut outputs = vec![
        json!({ "amount": refund_each,  "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.player_a_address } }),
        json!({ "amount": refund_each,  "scriptPublicKey": { "version": 0, "scriptPublicKey": &req.player_b_address } }),
    ];
    if treasury_amt > 0 {
        outputs.push(json!({ "amount": treasury_amt, "scriptPublicKey": { "version": 0, "scriptPublicKey": treasury_addr } }));
    }

    let mut tx = json!({
        "version": 0, "inputs": inputs, "outputs": outputs,
        "lockTime": 0, "subnetworkId": "0000000000000000000000000000000000000000",
        "gas": 0, "payload": ""
    });

    let tx_bytes = serde_json::to_vec(&tx)?;
    let h1: [u8; 32] = Sha256::digest(&tx_bytes).into();
    let h2  = Sha256::digest(h1);
    let tx_id = hex::encode(&h2[..32]);

    let signed = if let (Some(sk_hex), Some(rs_hex)) = (
        req.signing_key_hex.as_deref(),
        req.redeem_script_hex.as_deref(),
    ) {
        let hash       = sighash(&tx);
        let sig_hex    = schnorr_sign(sk_hex, &hash)?;
        let rs_bytes   = hex::decode(rs_hex).map_err(|_| anyhow::anyhow!("Invalid redeem_script_hex"))?;
        let script_sig = cancel_script_sig(&sig_hex, &rs_bytes);
        if let Some(arr) = tx["inputs"].as_array_mut() {
            for inp in arr.iter_mut() { inp["signatureScript"] = json!(script_sig); }
        }
        tracing::info!("[escrow] cancel TX signed (OP_IF) treasury={} amt={}", treasury_addr, treasury_amt);
        true
    } else {
        tracing::warn!("[escrow] cancel TX unsigned — signing_key_hex not provided");
        false
    };

    Ok(TxResponse { raw_tx: serde_json::to_string(&tx)?, tx_id, signed })
}
