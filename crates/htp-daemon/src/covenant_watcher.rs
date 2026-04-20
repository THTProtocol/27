//! Covenant Watcher Module
//! 
//! Subscribes to wRPC for UTXO changes on escrow addresses.
//! When escrow UTXO is spent (market resolved), triggers MiroFish bracket generation.

use kaspa_wasm::{WrpcClient, UtxosChangedEvent};
use mirofish_bridge::{MiroFishClient, TournamentBracket, BracketPlayer, BracketMatch, BracketStatus};
use std::path::PathBuf;
use tokio::fs;
use tracing::{info, warn, error, debug};

/// Start the covenant watcher
pub async fn start_watcher(
    client: WrpcClient,
    mirofish: MiroFishClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Covenant watcher started");

    // TODO: Load escrow addresses from configuration or covenant files
    // For now, using placeholder - in production this would come from covenants/
    let escrow_addresses: Vec<String> = vec![
        // Example: "kaspa:qpz...".to_string()
    ];

    if escrow_addresses.is_empty() {
        warn!("No escrow addresses configured. Watching will be inactive.");
        return Ok(());
    }

    info!("Watching {} escrow address(es)", escrow_addresses.len());

    // Subscribe to UTXO changes
    // When an escrow UTXO is spent, the market/covenant is resolved
    client.subscribe_utxos_changed(&escrow_addresses, move |event| {
        let client_clone = client.clone();
        let mirofish_clone = mirofish.clone();
        
        tokio::spawn(async move {
            handle_utxo_change(client_clone, mirofish_clone, event).await;
        });
    }).await?;

    info!("UTXO subscription active");

    Ok(())
}

/// Handle UTXO change event
async fn handle_utxo_change(
    _client: WrpcClient,
    mirofish: MiroFishClient,
    event: kaspa_wasm::UtxosChangedEvent,
) {
    info!("UTXO change detected: {:?}", event);

    // When escrow UTXO is spent = market resolved
    // Extract tournament data from the covenant resolution
    // For now, creating a sample bracket - in production this would parse covenant data
    
    let bracket = create_sample_bracket();
    
    match mirofish.generate_tournament_bracket(&bracket).await {
        Ok(image_data) => {
            info!("Tournament bracket image generated successfully ({} bytes)", image_data.len());
            
            // Save image to ~/high-table/generated/
            if let Err(e) = save_generated_image(&image_data, &bracket.tournament_id).await {
                error!("Failed to save generated image: {}", e);
            } else {
                info!("Bracket image saved to generated/");
            }
        }
        Err(e) => {
            error!("Failed to generate tournament bracket: {}", e);
        }
    }
}

/// Create a sample tournament bracket
/// In production, this would be parsed from covenant transaction data
fn create_sample_bracket() -> TournamentBracket {
    TournamentBracket {
        tournament_id: "tournament_001".to_string(),
        tournament_name: "High Table Championship".to_string(),
        players: vec![
            BracketPlayer {
                player_id: "p1".to_string(),
                pubkey: "kaspa:sample_pubkey_1".to_string(),
                name: "Player One".to_string(),
                seed: 1,
            },
            BracketPlayer {
                player_id: "p2".to_string(),
                pubkey: "kaspa:sample_pubkey_2".to_string(),
                name: "Player Two".to_string(),
                seed: 2,
            },
        ],
        matches: vec![
            BracketMatch {
                match_id: "m1".to_string(),
                round: 1,
                player1: Some("p1".to_string()),
                player2: Some("p2".to_string()),
                winner: None,
            },
        ],
        status: BracketStatus::InProgress,
    }
}

/// Save generated image to the generated directory
async fn save_generated_image(
    image_data: &[u8],
    tournament_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Ensure generated directory exists
    let generated_dir = PathBuf::from("/home/kasparov/high-table/generated");
    fs::create_dir_all(&generated_dir).await?;
    
    // Create filename with timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("{}_{}.png", tournament_id, timestamp);
    let filepath = generated_dir.join(&filename);
    
    // Write image data
    fs::write(&filepath, image_data).await?;
    
    debug!("Saved image to {:?}", filepath);
    
    Ok(())
}
