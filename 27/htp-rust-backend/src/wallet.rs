use anyhow::Result;
use sha2::{Sha256, Digest};
use crate::types::*;

/// Kaspa address prefix for testnet-12
const TN12_PREFIX: &str = "kaspatest";
/// Kaspa address prefix for mainnet
const MAINNET_PREFIX: &str = "kaspa";

/// BIP44 derivation path for Kaspa: m/44'/111111'/0'/0/0
const DERIVATION_PATH: &str = "m/44'/111111'/0'/0/0";

/// Derive a Kaspa address from a BIP39 mnemonic.
///
/// Uses the standard Kaspa derivation path m/44'/111111'/0'/0/0.
/// Returns the address and hex-encoded public key.
///
/// TODO: Integrate with kaspa-wallet-core for proper XPrv derivation.
/// Currently uses BIP39 seed generation and placeholder address derivation.
pub fn derive_from_mnemonic(req: &MnemonicRequest) -> Result<WalletResponse> {
    let network = req.network.as_deref().unwrap_or("testnet-12");
    let prefix = if network.contains("main") { MAINNET_PREFIX } else { TN12_PREFIX };

    // Validate mnemonic word count
    let words: Vec<&str> = req.mnemonic.split_whitespace().collect();
    if words.len() != 12 && words.len() != 24 {
        anyhow::bail!("Mnemonic must be 12 or 24 words, got {}", words.len());
    }

    // Parse and validate BIP39 mnemonic
    let mnemonic = bip39::Mnemonic::parse_normalized(&req.mnemonic)
        .map_err(|e| anyhow::anyhow!("Invalid BIP39 mnemonic: {}", e))?;

    // Generate seed from mnemonic (no passphrase)
    let seed = mnemonic.to_seed("");

    // TODO: Proper HD key derivation using kaspa-wallet-core
    // For now, derive a deterministic key from the seed using SHA-256
    // This is a PLACEHOLDER - real implementation needs secp256k1 HD derivation
    let mut hasher = Sha256::new();
    hasher.update(&seed);
    hasher.update(DERIVATION_PATH.as_bytes());
    let derived = hasher.finalize();

    let pubkey_hex = hex::encode(&derived[..32]);

    // TODO: Proper Kaspa address encoding (Bech32 with prefix)
    // Placeholder: use truncated hash as address suffix
    let addr_hash = hex::encode(&derived[..20]);
    let address = format!("{}:qr{}", prefix, &addr_hash);

    Ok(WalletResponse {
        address,
        public_key: pubkey_hex,
    })
}

/// Fetch the balance for a Kaspa address via the REST API.
pub async fn fetch_balance(address: &str, api_base: &str) -> Result<BalanceResponse> {
    let url = format!("{}/addresses/{}/balance", api_base, address);
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .send()
        .await?
        .json::<KaspaBalanceResponse>()
        .await?;

    let balance = resp.balance.unwrap_or(0);
    let balance_kas = format!("{:.8}", balance as f64 / 100_000_000.0);
    
    // TODO: Fetch actual UTXO count from /addresses/{addr}/utxos
    let utxo_count = 0u64;

    Ok(BalanceResponse {
        balance,
        balance_kas,
        utxo_count,
    })
}
