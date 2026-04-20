//! High Table Protocol Daemon
//! 
//! Main daemon entry point for Kaspa TN12 network.
//! Monitors covenant escrow addresses and triggers MiroFish image generation.

use kaspa_wasm::{Resolver, WrpcClient};
use mirofish_bridge::MiroFishClient;
use tracing::{info, error, Level};
use tracing_subscriber::FmtSubscriber;

mod covenant_watcher;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(true)
        .init();

    info!("Starting High Table Protocol Daemon on Kaspa TN12");

    // Initialize TN12 resolver
    info!("Connecting to Kaspa TN12 network...");
    let resolver = Resolver::new("tn12").await?;
    info!("Resolver initialized for tn12");

    // Create wRPC client
    let client = WrpcClient::new(resolver).await?;
    info!("wRPC client connected");

    // Initialize MiroFish client with fallback
    let mirofish = MiroFishClient::with_defaults();
    info!("MiroFish client initialized (primary: localhost:5001, fallback: localhost:3002)");

    // Start covenant watcher
    info!("Starting covenant watcher...");
    covenant_watcher::start_watcher(client, mirofish).await?;

    info!("Daemon running. Press Ctrl+C to stop.");

    // Keep the daemon running
    tokio::signal::ctrl_c().await?;
    info!("Shutting down daemon...");

    Ok(())
}
