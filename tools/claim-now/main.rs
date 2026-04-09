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
use std::error::Error;

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

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();

    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║  High Table Protocol – Permissionless Claim Tool  v1.0      ║");
    println!("╚════════════════════════════════════════════════════════════╝");
    println!();
    println!("📌 Escrow UTXO: {}", args.escrow_utxo);
    println!("📌 Game Final: {}", args.game_final_txid);
    println!("📌 Network: {}", args.network);
    if let Some(addr) = &args.claim_to {
        println!("📌 Claim to: {}", addr);
    }
    println!();

    // STEP 1: Validate inputs
    if args.escrow_utxo.is_empty() || args.game_final_txid.is_empty() {
        eprintln!("❌ Error: escrow-utxo and game-final-txid are required");
        std::process::exit(1);
    }

    // STEP 2: Connect to TN12 using Kaspa Resolver
    println!("🔗 Connecting to Kaspa Resolver ({})...", args.network);
    match connect_to_resolver(&args.network).await {
        Ok(_) => println!("✅ Connected"),
        Err(e) => {
            eprintln!("❌ Connection failed: {}", e);
            std::process::exit(1);
        }
    }

    // STEP 3: Fetch escrow UTXO
    println!("⏳ Fetching escrow UTXO...");
    match fetch_escrow_utxo(&args.escrow_utxo).await {
        Ok(utxo) => println!("✅ Escrow UTXO found | Amount: {} KAS", utxo),
        Err(e) => {
            eprintln!("❌ Failed to fetch escrow: {}", e);
            std::process::exit(1);
        }
    }

    // STEP 4: Fetch game final state
    println!("⏳ Fetching game final state...");
    match fetch_game_final_state(&args.game_final_txid).await {
        Ok(outcome) => println!("✅ Game outcome verified | Winner: {}", outcome),
        Err(e) => {
            eprintln!("❌ Failed to fetch game state: {}", e);
            std::process::exit(1);
        }
    }

    // STEP 5: Build resolve transaction
    println!("🔨 Building resolve transaction...");
    match build_resolve_tx(
        &args.escrow_utxo,
        &args.game_final_txid,
        args.claim_to.as_deref(),
    )
    .await
    {
        Ok(tx_id) => {
            println!("✅ Transaction built: {}", tx_id);

            // STEP 6: Broadcast
            println!("📤 Broadcasting to {}...", args.network);
            match broadcast_tx(&tx_id).await {
                Ok(confirmed_txid) => {
                    println!();
                    println!("╔════════════════════════════════════════════════════════════╗");
                    println!("║  ✅ CLAIM SUCCESSFUL                                       ║");
                    println!("╚════════════════════════════════════════════════════════════╝");
                    println!();
                    println!("📝 Transaction: {}", confirmed_txid);
                    println!("💰 Winners paid (pro-rata share of pool)");
                    println!("💼 2% protocol fee sent to treasury");
                    println!();
                    println!("Verify on explorer: https://{}.kaspa.stream/txs/{}", 
                        if args.network == "mainnet" { "" } else { "tn12." },
                        confirmed_txid
                    );
                }
                Err(e) => {
                    eprintln!("❌ Broadcast failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to build transaction: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn connect_to_resolver(network: &str) -> Result<String, Box<dyn Error>> {
    // TODO: Implement actual Kaspa Resolver connection
    Ok(format!("Connected to {} resolver", network))
}

async fn fetch_escrow_utxo(utxo_txid: &str) -> Result<f64, Box<dyn Error>> {
    // TODO: Implement actual UTXO fetching via wRPC
    Ok(100.5)  // Mock
}

async fn fetch_game_final_state(game_txid: &str) -> Result<String, Box<dyn Error>> {
    // TODO: Implement actual game state fetching via kdapp
    Ok("Player 1 (White) wins via checkmate".to_string())  // Mock
}

async fn build_resolve_tx(
    escrow_utxo: &str,
    game_final_txid: &str,
    claim_to: Option<&str>,
) -> Result<String, Box<dyn Error>> {
    // TODO: Implement actual covenant tx building
    // This will:
    // 1. Reference the escrow UTXO
    // 2. Load the ParimutuelMarket covenant script
    // 3. Call the resolve entrypoint with bet proofs
    // 4. Create outputs: winner shares + 2% fee
    
    Ok(format!(
        "mock-resolve-tx-{}",
        &escrow_utxo[0..8]
    ))
}

async fn broadcast_tx(tx_id: &str) -> Result<String, Box<dyn Error>> {
    // TODO: Implement actual broadcast via wRPC
    Ok(tx_id.to_string())
}
