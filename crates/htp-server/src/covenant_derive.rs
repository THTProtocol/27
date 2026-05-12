//! Thin wrapper: derives a MatchEscrow P2SH address from game creation params.
//!
//! Called by `create_game` route. Returns the deposit address players must
//! fund before the match starts. Anyone can re-derive this address
//! independently using the same 5 parameters — that's the trustless guarantee.

use htp_covenant::{
    address::CovenantAddress,
    params::EscrowParams,
};
use sha2::{Sha256, Digest};
use ripemd::Ripemd160;
use bech32::{self, FromBase32};

/// Derive a deterministic P2SH deposit address for a MatchEscrow covenant.
///
/// # Parameters
/// - `creator_addr`  — kaspa[test]: address of player A (bech32)
/// - `opponent_addr` — kaspa[test]: address of player B, or "open" if TBD
/// - `oracle_hash160_hex` — 40-char hex HASH160 of oracle pubkey (from env)
/// - `stake_sompi`   — wager in sompi
/// - `deadline_daa`  — DAA score refund deadline (0 = use default)
/// - `network`       — "tn12" or "mainnet"
pub fn derive_escrow_address(
    creator_addr: &str,
    opponent_addr: &str,
    oracle_hash160_hex: &str,
    stake_sompi: i64,
    deadline_daa: i64,
    network: &str,
) -> Result<DerivedEscrow, String> {
    let player_a = addr_to_hash160(creator_addr)?;
    let player_b = addr_to_hash160(opponent_addr)?;

    let params = EscrowParams {
        player_a_hash160: hex::encode(player_a),
        player_b_hash160: hex::encode(player_b),
        oracle_hash160:   oracle_hash160_hex.to_string(),
        wager_sompi:      stake_sompi,
        deadline_daa:     if deadline_daa > 0 { deadline_daa } else { 60_000_000 },
        network:          network.to_string(),
    };

    let covenant = CovenantAddress::derive(&params)
        .map_err(|e| format!("covenant derivation failed: {}", e))?;

    Ok(DerivedEscrow {
        deposit_address:    covenant.address,
        redeem_script_hex:  covenant.redeem_script_hex,
        script_hash_160:    covenant.script_hash_160_hex,
        player_a_hash160:   params.player_a_hash160,
        player_b_hash160:   params.player_b_hash160,
        oracle_hash160:     params.oracle_hash160,
        stake_sompi,
        deadline_daa:       params.deadline_daa,
        network:            params.network,
    })
}

/// Result of covenant address derivation.
#[derive(Debug, Clone)]
pub struct DerivedEscrow {
    pub deposit_address:   String,
    pub redeem_script_hex: String,
    pub script_hash_160:   String,
    pub player_a_hash160:  String,
    pub player_b_hash160:  String,
    pub oracle_hash160:    String,
    pub stake_sompi:       i64,
    pub deadline_daa:      i64,
    pub network:           String,
}

/// Convert a Kaspa bech32 address to HASH160 (20 bytes).
/// - "open" / empty → zero bytes (TBD slot)
/// - P2SH (version 0x08) → extract 20-byte hash directly from payload
/// - P2PK (version 0x00 / 0x01) → SHA256 then RIPEMD160 of pubkey bytes
fn addr_to_hash160(addr: &str) -> Result<[u8; 20], String> {
    if addr == "open" || addr.is_empty() || addr == "kaspatest:open" {
        return Ok([0u8; 20]);
    }

    // bech32 0.9: decode returns (hrp: String, data: Vec<u5>, variant: Variant)
    let (_hrp, data5, _variant) = bech32::decode(addr)
        .map_err(|e| format!("bech32 decode failed for '{}': {}", addr, e))?;

    // convert from 5-bit groups to 8-bit bytes
    let bytes = Vec::<u8>::from_base32(&data5)
        .map_err(|e| format!("bech32 base32->bytes failed: {}", e))?;

    if bytes.is_empty() {
        return Err(format!("empty payload for address: {}", addr));
    }

    // Kaspa address encoding:
    //   byte[0] = version/type
    //   0x00 or 0x01 = P2PK  → remaining bytes are the pubkey
    //   0x08         = P2SH  → remaining 20 bytes ARE the script hash
    let version = bytes[0];
    let payload = &bytes[1..];

    match version {
        0x08 => {
            // P2SH: payload is already the 20-byte hash
            if payload.len() < 20 {
                return Err(format!("P2SH payload too short: {} bytes", payload.len()));
            }
            let mut arr = [0u8; 20];
            arr.copy_from_slice(&payload[..20]);
            Ok(arr)
        }
        _ => {
            // P2PK or unknown: HASH160 the payload
            let sha: [u8; 32] = Sha256::digest(payload).into();
            let h160: [u8; 20] = Ripemd160::digest(sha).into();
            Ok(h160)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_gives_zero_hash() {
        assert_eq!(addr_to_hash160("open").unwrap(), [0u8; 20]);
    }

    #[test]
    fn derive_open_game() {
        let oracle = "0303030303030303030303030303030303030303";
        let r = derive_escrow_address(
            "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj",
            "open",
            oracle,
            100_000_000_000,
            50_000_000,
            "tn12",
        ).unwrap();
        assert!(r.deposit_address.starts_with("kaspatest"), "addr={}", r.deposit_address);
    }
}
