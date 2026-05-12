//! Derives a Kaspa P2SH address from MatchEscrow covenant parameters.
//!
//! Address format: bech32
//!   - TN12 prefix:    "kaspatest"
//!   - Mainnet prefix: "kaspa"
//!   - Version byte:   0x08 (P2SH)
//!
//! Derivation path:
//!   params → redeem_script → SHA256 → RIPEMD160 → bech32(prefix, 0x08 + hash160)

use bech32::{ToBase32, Variant};
use silverscript::{
    encoder::{MatchEscrowParams, ScriptEncoder},
};

use crate::error::CovenantError;
use crate::params::EscrowParams;

/// A fully derived covenant address with its supporting data.
#[derive(Debug, Clone)]
pub struct CovenantAddress {
    /// The bech32 P2SH address (e.g. kaspatest:pq...)
    pub address: String,
    /// Hex of the redeem script (for verification and spending)
    pub redeem_script_hex: String,
    /// Hex of script_hash_160 (20 bytes)
    pub script_hash_160_hex: String,
    /// Network
    pub network: String,
}

/// P2SH version byte for Kaspa
const P2SH_VERSION: u8 = 0x08;

impl CovenantAddress {
    /// Derive a covenant address from escrow parameters.
    pub fn derive(params: &EscrowParams) -> Result<Self, CovenantError> {
        // Decode hex params
        let player_a = decode_hash160(&params.player_a_hash160)?;
        let player_b = decode_hash160(&params.player_b_hash160)?;
        let oracle   = decode_hash160(&params.oracle_hash160)?;

        let script_params = MatchEscrowParams {
            player_a,
            player_b,
            oracle,
            wager_sompi: params.wager_sompi,
            deadline_daa: params.deadline_daa,
        };

        let covenant = ScriptEncoder::compile_match_escrow(&script_params)?;

        // Build payload: version_byte || hash160
        let mut payload = Vec::with_capacity(21);
        payload.push(P2SH_VERSION);
        payload.extend_from_slice(&covenant.script_hash_160);

        // bech32 encode
        let hrp = if params.is_testnet() { "kaspatest" } else { "kaspa" };
        let address = bech32::encode(hrp, payload.to_base32(), Variant::Bech32)
            .map_err(|e| CovenantError::AddressEncoding(e.to_string()))?;

        Ok(CovenantAddress {
            address,
            redeem_script_hex: covenant.redeem_script_hex,
            script_hash_160_hex: hex::encode(covenant.script_hash_160),
            network: params.network.clone(),
        })
    }
}

fn decode_hash160(hex_str: &str) -> Result<[u8; 20], CovenantError> {
    let bytes = hex::decode(hex_str)?;
    if bytes.len() != 20 {
        return Err(CovenantError::InvalidParam(format!(
            "hash160 must be 20 bytes, got {}", bytes.len()
        )));
    }
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_tn12_address() {
        let params = EscrowParams {
            player_a_hash160: "0101010101010101010101010101010101010101".into(),
            player_b_hash160: "0202020202020202020202020202020202020202".into(),
            oracle_hash160:   "0303030303030303030303030303030303030303".into(),
            wager_sompi: 100_000_000_000,
            deadline_daa: 50_000_000,
            network: "tn12".into(),
        };

        let result = CovenantAddress::derive(&params).unwrap();

        assert!(result.address.starts_with("kaspatest"));
        assert!(!result.redeem_script_hex.is_empty());
        println!("TN12 covenant address: {}", result.address);
        println!("redeem_script: {}", result.redeem_script_hex);
    }

    #[test]
    fn deterministic_across_calls() {
        let params = EscrowParams {
            player_a_hash160: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into(),
            player_b_hash160: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb".into(),
            oracle_hash160:   "cccccccccccccccccccccccccccccccccccccccc".into(),
            wager_sompi: 500_000_000,
            deadline_daa: 60_000_000,
            network: "tn12".into(),
        };

        let a1 = CovenantAddress::derive(&params).unwrap();
        let a2 = CovenantAddress::derive(&params).unwrap();
        assert_eq!(a1.address, a2.address);
    }
}
