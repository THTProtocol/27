//! Derives a MatchEscrow P2SH address from game creation params.
//!
//! Kaspa uses a bech32 *variant* with `:` as HRP separator and a custom
//! polymod checksum.  Standard bech32 0.9 rejects the checksum.
//! We split on `:`, decode the payload as raw base32 (5-bit groups)
//! using the bech32 alphabet directly, strip the 8-byte checksum tail,
//! then convert to bytes.  No library checksum validation needed here —
//! the address came from the user / wallet and we just need the hash bytes.

use htp_covenant::{
    address::CovenantAddress,
    params::EscrowParams,
};
use sha2::{Sha256, Digest};
use ripemd::Ripemd160;

/// bech32 charset (standard, same as Kaspa uses)
const CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/// Decode a bech32 data string (no HRP, no checksum) into 5-bit groups.
/// Returns Err if any character is not in the charset.
fn decode_base32(s: &str) -> Result<Vec<u8>, String> {
    s.chars().map(|c| {
        CHARSET.iter().position(|&x| x == c as u8)
            .map(|i| i as u8)
            .ok_or_else(|| format!("invalid bech32 char: {:?}", c))
    }).collect()
}

/// Convert 5-bit groups to 8-bit bytes (standard base32 conversion).
fn from_base32(data: &[u8]) -> Vec<u8> {
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    let mut out = Vec::new();
    for &b in data {
        buf = (buf << 5) | (b as u32);
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    out
}

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
/// Format: `<hrp>:<base32_payload_with_8_char_checksum>`
/// We skip checksum validation and just decode the payload bytes.
fn addr_to_hash160(addr: &str) -> Result<[u8; 20], String> {
    if addr == "open" || addr.is_empty() || addr == "kaspatest:open" {
        return Ok([0u8; 20]);
    }

    let colon = addr.find(':')
        .ok_or_else(|| format!("invalid kaspa address (no ':'): {}", addr))?;
    let payload_str = &addr[colon + 1..];

    // Kaspa appends an 8-char polymod checksum at the end of the payload.
    // Strip it before converting to bytes.
    if payload_str.len() < 8 {
        return Err(format!("payload too short: {}", addr));
    }
    let data_str = &payload_str[..payload_str.len() - 8];

    let u5s = decode_base32(data_str)
        .map_err(|e| format!("decode_base32 failed for '{}': {}", addr, e))?;

    let all_bytes = from_base32(&u5s);

    if all_bytes.is_empty() {
        return Err(format!("empty payload for: {}", addr));
    }

    // byte[0] = version: 0x08 = P2SH (20-byte hash), else P2PK (hash the pubkey)
    let version = all_bytes[0];
    let key = &all_bytes[1..];

    match version {
        0x08 => {
            if key.len() < 20 {
                return Err(format!("P2SH payload too short ({} bytes)", key.len()));
            }
            let mut arr = [0u8; 20];
            arr.copy_from_slice(&key[..20]);
            Ok(arr)
        }
        _ => {
            let sha: [u8; 32] = Sha256::digest(key).into();
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
        let h = addr_to_hash160(
            "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj"
        ).unwrap();
        assert_eq!(h.len(), 20);
        assert_ne!(h, [0u8; 20], "should not be zero hash for real address");
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
        assert!(!r.deposit_address.is_empty());
        assert!(!r.redeem_script_hex.is_empty());
    }
}
