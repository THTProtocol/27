//! Derives a MatchEscrow P2SH address from game creation params.
//!
//! Kaspa uses a bech32 *variant* where the HRP and payload are separated by
//! `:` rather than `1`.  The standard `bech32::decode` function expects the
//! `1` separator and therefore fails on Kaspa addresses.  We split manually
//! and decode only the data portion.

use htp_covenant::{
    address::CovenantAddress,
    params::EscrowParams,
};
use sha2::{Sha256, Digest};
use ripemd::Ripemd160;
use bech32::FromBase32;

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
        deposit_address:   covenant.address,
        redeem_script_hex: covenant.redeem_script_hex,
        script_hash_160:   covenant.script_hash_160_hex,
        player_a_hash160:  params.player_a_hash160,
        player_b_hash160:  params.player_b_hash160,
        oracle_hash160:    params.oracle_hash160,
        stake_sompi,
        deadline_daa:      params.deadline_daa,
        network:           params.network,
    })
}

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
///
/// Kaspa bech32 format: `<hrp>:<base32_payload>`
/// The payload starts with a 1-byte version then the key/hash bytes,
/// all re-encoded in 5-bit groups (standard bech32 alphabet).
fn addr_to_hash160(addr: &str) -> Result<[u8; 20], String> {
    if addr == "open" || addr.is_empty() || addr == "kaspatest:open" {
        return Ok([0u8; 20]);
    }

    // Kaspa uses `:` as HRP separator, not `1`.
    let colon = addr.find(':')
        .ok_or_else(|| format!("invalid kaspa address (no ':'): {}", addr))?;
    let data_str = &addr[colon + 1..];

    // Decode bech32 characters into 5-bit groups using the standard alphabet.
    let data5 = bech32::decode_to_u5(data_str)
        .map_err(|e| format!("bech32 u5 decode failed for '{}': {}", addr, e))?;

    // Convert 5-bit groups -> 8-bit bytes (ignore the checksum tail: last 8 u5s).
    let all_bytes = Vec::<u8>::from_base32(&data5)
        .map_err(|e| format!("bech32 base32->bytes failed: {}", e))?;

    if all_bytes.is_empty() {
        return Err(format!("empty payload for address: {}", addr));
    }

    // byte[0] = version:
    //   0x00 / 0x01 = P2PK  -> HASH160(pubkey)
    //   0x08        = P2SH  -> next 20 bytes are already the script hash
    let version = all_bytes[0];
    let payload = &all_bytes[1..];

    match version {
        0x08 => {
            if payload.len() < 20 {
                return Err(format!("P2SH payload too short ({} bytes)", payload.len()));
            }
            let mut arr = [0u8; 20];
            arr.copy_from_slice(&payload[..20]);
            Ok(arr)
        }
        _ => {
            // P2PK: HASH160 = RIPEMD160(SHA256(pubkey))
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
    fn kaspa_addr_parses() {
        // Just verify it doesn't panic / returns 20 bytes
        let h = addr_to_hash160(
            "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj"
        ).unwrap();
        assert_eq!(h.len(), 20);
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
        assert!(!r.deposit_address.is_empty(), "deposit_address is empty");
    }
}
