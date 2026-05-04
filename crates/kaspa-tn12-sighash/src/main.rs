//! Kaspa TN12 SigHash implementation
//!
//! Matches rusty-kaspa consensus/core/src/hashing/sighash.rs
//! Hash-of-hashes pattern: each component is individually hashed,
//! then all component hashes are concatenated and double-SHA256'd.
//!
//! Usage (stdin JSON):
//!   echo '{"hash_type":"all", "transaction": {...}}' | ./kaspa-tn12-sighash

use sha2::{Digest, Sha256};
use serde::Deserialize;
use std::io::{self, Read};

// ── domain-separation tags (must match rusty-kaspa exactly) ──────────────────
const HASH_DOMAIN_TRANSACTION:      &[u8] = b"TransactionHash";
const HASH_DOMAIN_TRANSACTION_ID:   &[u8] = b"TransactionID";
const HASH_DOMAIN_SIGHASH:          &[u8] = b"TransactionSigningHash";
const HASH_DOMAIN_SIGHASH_ECDSA:    &[u8] = b"TransactionSigningHashECDSA";
const HASH_DOMAIN_OUTPOINT:         &[u8] = b"TransactionSigningHashOutpoint";
const HASH_DOMAIN_SEQUENCE:         &[u8] = b"TransactionSigningHashSequence";
const HASH_DOMAIN_SIGOPCOUNT:       &[u8] = b"TransactionSigningHashSigOpCount";
const HASH_DOMAIN_OUTPUTS:          &[u8] = b"TransactionSigningHashOutputs";

// ── tagged double-SHA256 helper ───────────────────────────────────────────────
fn tagged_hash(tag: &[u8], data: &[u8]) -> [u8; 32] {
    // tag_hash = SHA256(tag)
    let tag_hash = Sha256::digest(tag);
    // final = SHA256(tag_hash || tag_hash || data)
    let mut h = Sha256::new();
    h.update(&tag_hash);
    h.update(&tag_hash);
    h.update(data);
    h.finalize().into()
}

// ── little-endian helpers ────────────────────────────────────────────────────
fn u16_le(v: u16) -> [u8; 2] { v.to_le_bytes() }
fn u32_le(v: u32) -> [u8; 4] { v.to_le_bytes() }
fn u64_le(v: u64) -> [u8; 8] { v.to_le_bytes() }

// ── JSON input schema ────────────────────────────────────────────────────────
#[derive(Deserialize)]
struct Input {
    transaction_id: String,   // hex, 32 bytes
    index:          u32,
    sequence:       u64,
    sig_op_count:   u8,
    utxo:           Utxo,
}

#[derive(Deserialize)]
struct Utxo {
    amount:            u64,
    script_public_key: SpkWrapper,
}

#[derive(Deserialize)]
struct SpkWrapper {
    version: u16,
    script:  String,   // hex
}

#[derive(Deserialize)]
struct Output {
    amount:            u64,
    script_public_key: SpkWrapper,
}

#[derive(Deserialize)]
struct Transaction {
    version:       u16,
    inputs:        Vec<Input>,
    outputs:       Vec<Output>,
    lock_time:     u64,
    subnetwork_id: String,   // hex 20 bytes
    gas:           u64,
    payload:       String,   // hex
}

#[derive(Deserialize)]
struct Request {
    hash_type:   String,     // "all" | "anyone_can_pay" | "single" | "none"
    input_index: Option<usize>,
    ecdsa:       Option<bool>,
    transaction: Transaction,
}

// ── sighash_type byte ────────────────────────────────────────────────────────
fn sighash_type_byte(s: &str) -> u8 {
    match s {
        "all"            => 0x01,
        "none"           => 0x02,
        "single"         => 0x03,
        "anyone_can_pay" => 0x80,
        _                => panic!("unknown hash_type: {}", s),
    }
}

// ── hash outpoints ───────────────────────────────────────────────────────────
fn hash_outpoints(inputs: &[Input]) -> [u8; 32] {
    let mut buf = Vec::with_capacity(inputs.len() * 36);
    for inp in inputs {
        let txid = hex::decode(&inp.transaction_id).expect("invalid txid hex");
        assert_eq!(txid.len(), 32, "txid must be 32 bytes");
        buf.extend_from_slice(&txid);
        buf.extend_from_slice(&u32_le(inp.index));
    }
    tagged_hash(HASH_DOMAIN_OUTPOINT, &buf)
}

// ── hash sequences ───────────────────────────────────────────────────────────
fn hash_sequences(inputs: &[Input]) -> [u8; 32] {
    let mut buf = Vec::with_capacity(inputs.len() * 8);
    for inp in inputs {
        buf.extend_from_slice(&u64_le(inp.sequence));
    }
    tagged_hash(HASH_DOMAIN_SEQUENCE, &buf)
}

// ── hash sig-op counts ───────────────────────────────────────────────────────
fn hash_sig_op_counts(inputs: &[Input]) -> [u8; 32] {
    let mut buf: Vec<u8> = inputs.iter().map(|i| i.sig_op_count).collect();
    tagged_hash(HASH_DOMAIN_SIGOPCOUNT, &buf)
}

// ── hash outputs ─────────────────────────────────────────────────────────────
fn hash_outputs(outputs: &[Output]) -> [u8; 32] {
    let mut buf = Vec::new();
    for out in outputs {
        buf.extend_from_slice(&u64_le(out.amount));
        buf.extend_from_slice(&u16_le(out.script_public_key.version));
        let script = hex::decode(&out.script_public_key.script)
            .expect("invalid output script hex");
        buf.extend_from_slice(&(script.len() as u64).to_le_bytes());
        buf.extend_from_slice(&script);
    }
    tagged_hash(HASH_DOMAIN_OUTPUTS, &buf)
}

// ── main sighash ─────────────────────────────────────────────────────────────
fn calc_sighash(req: &Request) -> [u8; 32] {
    let tx       = &req.transaction;
    let idx      = req.input_index.unwrap_or(0);
    let inp      = &tx.inputs[idx];
    let ht_byte  = sighash_type_byte(&req.hash_type);
    let use_ecdsa = req.ecdsa.unwrap_or(false);

    // outpoints
    let hash_outpoints    = hash_outpoints(&tx.inputs);
    let hash_sequences    = hash_sequences(&tx.inputs);
    let hash_sig_op_counts = hash_sig_op_counts(&tx.inputs);
    let hash_outputs      = hash_outputs(&tx.outputs);

    // subnetwork (20 bytes)
    let subnet = hex::decode(&tx.subnetwork_id).expect("invalid subnetwork_id hex");
    assert_eq!(subnet.len(), 20, "subnetwork_id must be 20 bytes");

    // payload
    let payload = hex::decode(&tx.payload).unwrap_or_default();

    // utxo script
    let spk_script = hex::decode(&inp.utxo.script_public_key.script)
        .expect("invalid utxo script hex");

    // txid (reversed for sighash — kaspa stores txid as big-endian display,
    // but the signing hash uses raw LE bytes from the hash)
    let txid = hex::decode(&inp.transaction_id).expect("invalid txid hex");

    // ── assemble signing message ──────────────────────────────────────────
    let mut msg = Vec::new();

    // version
    msg.extend_from_slice(&u16_le(tx.version));
    // hash_type
    msg.push(ht_byte);
    // hash_outpoints
    msg.extend_from_slice(&hash_outpoints);
    // hash_sequences
    msg.extend_from_slice(&hash_sequences);
    // hash_sig_op_counts
    msg.extend_from_slice(&hash_sig_op_counts);
    // this input's outpoint
    msg.extend_from_slice(&txid);
    msg.extend_from_slice(&u32_le(inp.index));
    // this input's utxo
    msg.extend_from_slice(&u16_le(inp.utxo.script_public_key.version));
    msg.extend_from_slice(&(spk_script.len() as u64).to_le_bytes());
    msg.extend_from_slice(&spk_script);
    msg.extend_from_slice(&u64_le(inp.utxo.amount));
    // sequence
    msg.extend_from_slice(&u64_le(inp.sequence));
    // sig_op_count
    msg.push(inp.sig_op_count);
    // outputs
    msg.extend_from_slice(&hash_outputs);
    // lock_time
    msg.extend_from_slice(&u64_le(tx.lock_time));
    // subnetwork
    msg.extend_from_slice(&subnet);
    // gas
    msg.extend_from_slice(&u64_le(tx.gas));
    // payload hash
    let payload_hash = tagged_hash(HASH_DOMAIN_TRANSACTION, &payload);
    msg.extend_from_slice(&payload_hash);

    let domain = if use_ecdsa { HASH_DOMAIN_SIGHASH_ECDSA } else { HASH_DOMAIN_SIGHASH };
    tagged_hash(domain, &msg)
}

fn main() {
    let mut raw = String::new();
    io::stdin().read_to_string(&mut raw).expect("failed to read stdin");
    let req: Request = serde_json::from_str(&raw).expect("invalid JSON input");
    let hash = calc_sighash(&req);
    println!("{}", hex::encode(hash));
}

// ── unit tests ───────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_request() -> Request {
        Request {
            hash_type:   "all".into(),
            input_index: Some(0),
            ecdsa:       None,
            transaction: Transaction {
                version:       0,
                lock_time:     0,
                subnetwork_id: "0000000000000000000000000000000000000000".into(),
                gas:           0,
                payload:       "".into(),
                inputs: vec![Input {
                    transaction_id: "a".repeat(64),
                    index:          0,
                    sequence:       u64::MAX,
                    sig_op_count:   1,
                    utxo: Utxo {
                        amount: 100_000_000,
                        script_public_key: SpkWrapper {
                            version: 0,
                            script:  "20".to_string() + &"bb".repeat(32) + "ac",
                        },
                    },
                }],
                outputs: vec![Output {
                    amount: 90_000_000,
                    script_public_key: SpkWrapper {
                        version: 0,
                        script:  "20".to_string() + &"cc".repeat(32) + "ac",
                    },
                }],
            },
        }
    }

    #[test]
    fn sighash_is_32_bytes() {
        let req  = dummy_request();
        let hash = calc_sighash(&req);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn sighash_is_deterministic() {
        let req = dummy_request();
        assert_eq!(calc_sighash(&req), calc_sighash(&req));
    }

    #[test]
    fn sighash_changes_with_amount() {
        let mut req = dummy_request();
        let h1 = calc_sighash(&req);
        req.transaction.inputs[0].utxo.amount = 200_000_000;
        let h2 = calc_sighash(&req);
        assert_ne!(h1, h2, "sighash must change when utxo amount changes");
    }

    #[test]
    fn sighash_changes_with_output() {
        let mut req = dummy_request();
        let h1 = calc_sighash(&req);
        req.transaction.outputs[0].amount = 50_000_000;
        let h2 = calc_sighash(&req);
        assert_ne!(h1, h2, "sighash must change when output amount changes");
    }
}
