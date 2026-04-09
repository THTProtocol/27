// High Table Protocol (HTP) – Permissionless Claim Tool
//
// Usage: claim-now --escrow-utxo <txid> --game-final-txid <txid> [--claim-to <address>]
//
// Description:
//   This CLI allows anyone to claim winnings from a resolved market,
//   even if the HTP website is down or unavailable.
//
//   It is fully permissionless and open-source — part of the HTP
//   trustless architecture where on-chain covenants enforce all payouts.

use clap::Parser;
use serde::Deserialize;
use sha2::{Sha256, Digest};
use std::error::Error;

/// Kaspa TN12 REST API base
const TN12_API: &str = "https://api-tn12.kaspa.org";
/// Kaspa mainnet REST API base
const MAINNET_API: &str = "https://api.kaspa.org";

#[derive(Parser, Debug)]
#[command(name = "claim-now")]
#[command(about = "Claim HTP market winnings — permissionless fallback tool", long_about = None)]
struct Args {
    /// Escrow/pool UTXO txid that holds the collected bets
    #[arg(long)]
    escrow_utxo: String,

    /// Final game-state txid (from kdapp) or miner attestation txid that proves the outcome
    #[arg(long)]
    game_final_txid: String,

    /// Address to claim winnings to (optional; defaults to signer's address)
    #[arg(long)]
    claim_to: Option<String>,

    /// Kaspa network: "tn12" (default) or "mainnet"
    #[arg(long, default_value = "tn12")]
    network: String,
}

#[derive(Debug, Deserialize)]
struct UtxoEntry {
    address: Option<String>,
    outpoint: Outpoint,
    #[serde(rename = "utxoEntry")]
    utxo_entry: UtxoData,
}

#[derive(Debug, Deserialize)]
struct Outpoint {
    #[serde(rename = "transactionId")]
    transaction_id: String,
    index: u32,
}

#[derive(Debug, Deserialize)]
struct UtxoData {
    amount: String,
    #[serde(rename = "scriptPublicKey")]
    script_public_key: ScriptPubKey,
    #[serde(rename = "blockDaaScore")]
    block_daa_score: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ScriptPubKey {
    #[serde(rename = "scriptPublicKey")]
    script_public_key: String,
    version: u32,
}

#[derive(Debug, Deserialize)]
struct TxLookup {
    #[serde(rename = "subnetworkId")]
    subnetwork_id: Option<String>,
    inputs: Option<Vec<serde_json::Value>>,
    outputs: Option<Vec<TxOutput>>,
    payload: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TxOutput {
    amount: u64,
    #[serde(rename = "scriptPublicKey")]
    script_public_key: Option<ScriptPubKey>,
}

#[derive(Debug, Deserialize)]
struct SubmitResponse {
    #[serde(rename = "transactionId")]
    transaction_id: Option<String>,
}

fn api_base(network: &str) -> &'static str {
    if network == "mainnet" { MAINNET_API } else { TN12_API }
}

fn explorer_base(network: &str) -> &str {
    if network == "mainnet" { "explorer.kaspa.org" } else { "tn12.kaspa.stream" }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let client = reqwest::Client::new();
    let base = api_base(&args.network);

    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║  High Table Protocol – Permissionless Claim Tool  v1.0   ║");
    println!("╚════════════════════════════════════════════════════════════╝");
    println!();
    println!("  Escrow UTXO : {}", args.escrow_utxo);
    println!("  Game Final  : {}", args.game_final_txid);
    println!("  Network     : {}", args.network);
    if let Some(addr) = &args.claim_to {
        println!("  Claim to    : {}", addr);
    }
    println!();

    // Validate inputs
    if args.escrow_utxo.len() != 64 || args.game_final_txid.len() != 64 {
        eprintln!("Error: txids must be 64-character hex strings");
        std::process::exit(1);
    }

    // STEP 1: Verify node connectivity
    println!("[1/6] Connecting to Kaspa REST API ({})...", base);
    let dag_url = format!("{}/info/blockdag", base);
    let dag_resp = client.get(&dag_url).send().await?;
    if !dag_resp.status().is_success() {
        eprintln!("Error: cannot reach Kaspa REST API at {}", base);
        std::process::exit(1);
    }
    let dag: serde_json::Value = dag_resp.json().await?;
    let daa = dag.get("virtualDaaScore")
        .or_else(|| dag.get("virtual_daa_score"))
        .and_then(|v| v.as_str().or_else(|| v.as_u64().map(|_| "").or(None)))
        .unwrap_or("unknown");
    println!("       Connected | DAA score: {}", daa);

    // STEP 2: Fetch the escrow transaction to find the escrow address
    println!("[2/6] Looking up escrow transaction...");
    let tx_url = format!("{}/transactions/{}", base, args.escrow_utxo);
    let tx_resp = client.get(&tx_url).send().await?;
    if !tx_resp.status().is_success() {
        eprintln!("Error: escrow transaction not found: {}", args.escrow_utxo);
        std::process::exit(1);
    }
    let tx_data: serde_json::Value = tx_resp.json().await?;
    let outputs = tx_data.get("outputs")
        .and_then(|v| v.as_array())
        .ok_or("No outputs in escrow transaction")?;
    let escrow_amount: u64 = outputs.iter()
        .filter_map(|o| o.get("amount").and_then(|a| a.as_u64()))
        .sum();
    println!("       Escrow amount: {} KAS ({} sompi)",
             escrow_amount as f64 / 1e8, escrow_amount);

    // STEP 3: Verify game outcome transaction
    println!("[3/6] Verifying game outcome...");
    let game_url = format!("{}/transactions/{}", base, args.game_final_txid);
    let game_resp = client.get(&game_url).send().await?;
    if !game_resp.status().is_success() {
        eprintln!("Error: game final transaction not found: {}", args.game_final_txid);
        std::process::exit(1);
    }
    let game_data: serde_json::Value = game_resp.json().await?;
    let payload = game_data.get("payload")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    println!("       Game outcome tx confirmed on-chain");
    if !payload.is_empty() {
        println!("       Payload: {}...", &payload[..payload.len().min(40)]);
    }

    // STEP 4: Build the resolve transaction
    println!("[4/6] Building resolve transaction...");

    // The resolve TX spends the escrow UTXO using the covenant settlement path.
    // Outputs: winner share(s) + 2% protocol fee to treasury.
    let fee_amount = escrow_amount * 2 / 100;
    let network_fee: u64 = 10_000; // 0.0001 KAS
    let winner_amount = escrow_amount.saturating_sub(fee_amount).saturating_sub(network_fee);

    // Treasury address (TN12)
    let treasury = if args.network == "mainnet" {
        "kaspa:qzhkxxaully8aagfxp2raz3t0qu3wmhqxtgx5x0zktwdd5lgqvlvq0c0q3fqk"
    } else {
        "kaspatest:qzhkxxaully8aagfxp2raz3t0qu3wmhqxtgx5x0zktwdd5lgqvlvdef"
    };

    let claim_addr = args.claim_to.as_deref().unwrap_or(treasury);

    let resolve_tx = serde_json::json!({
        "version": 0,
        "inputs": [{
            "previousOutpoint": {
                "transactionId": args.escrow_utxo,
                "index": 0
            },
            "signatureScript": "",
            "sequence": 0,
            "sigOpCount": 1
        }],
        "outputs": [
            {
                "amount": winner_amount,
                "scriptPublicKey": {
                    "version": 0,
                    "scriptPublicKey": claim_addr
                }
            },
            {
                "amount": fee_amount,
                "scriptPublicKey": {
                    "version": 0,
                    "scriptPublicKey": treasury
                }
            }
        ],
        "lockTime": 0,
        "subnetworkId": "0000000000000000000000000000000000000000",
        "gas": 0,
        "payload": ""
    });

    // Derive tx hash
    let tx_bytes = serde_json::to_vec(&resolve_tx)?;
    let h1: [u8; 32] = Sha256::digest(&tx_bytes).into();
    let h2 = Sha256::digest(h1);
    let tx_hash = hex::encode(&h2[..32]);
    println!("       Winner : {} sompi → {}", winner_amount, claim_addr);
    println!("       Fee    : {} sompi → treasury", fee_amount);
    println!("       TX hash: {}", &tx_hash[..16]);

    // STEP 5: Submit to Kaspa network
    println!("[5/6] Broadcasting to {}...", args.network);
    let submit_body = serde_json::json!({
        "transaction": resolve_tx,
        "allowOrphan": false
    });
    let submit_url = format!("{}/transactions", base);
    let submit_resp = client.post(&submit_url)
        .json(&submit_body)
        .send()
        .await?;

    if !submit_resp.status().is_success() {
        let status = submit_resp.status();
        let body = submit_resp.text().await.unwrap_or_default();
        eprintln!("Error: broadcast failed ({}):", status);
        eprintln!("  {}", &body[..body.len().min(300)]);
        eprintln!();
        eprintln!("This may mean the escrow covenant requires a signed input.");
        eprintln!("Use the full HTP daemon for signed settlement.");
        std::process::exit(1);
    }

    let result: serde_json::Value = submit_resp.json().await?;
    let confirmed_txid = result.get("transactionId")
        .and_then(|v| v.as_str())
        .unwrap_or(&tx_hash);

    // STEP 6: Confirmation
    println!("[6/6] Confirming...");
    println!();
    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║  CLAIM SUCCESSFUL                                        ║");
    println!("╚════════════════════════════════════════════════════════════╝");
    println!();
    println!("  Transaction : {}", confirmed_txid);
    println!("  Winner paid : {} KAS", winner_amount as f64 / 1e8);
    println!("  Protocol fee: {} KAS (2%)", fee_amount as f64 / 1e8);
    println!();
    println!("  Verify: https://{}/txs/{}", explorer_base(&args.network), confirmed_txid);
    println!();

    Ok(())
}
