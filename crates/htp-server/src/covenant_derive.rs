//! Derives a MatchEscrow P2SH address from game creation params.
//!
//! Kaspa uses a bech32 *variant* where the HRP and payload are separated by
//! `:` rather than `1`.  We split on `:`, then decode only the payload portion
//! using bech32 0.9's `decode` by temporarily re-encoding it with a dummy
//! HRP that the library accepts (i.e. adding a `1` separator ourselves).

use htp_covenant::{
    address::CovenantAddress,
    params::EscrowParams,
};
use sha2::{Sha256, Digest};
use ripemd::Ripemd160;
use bech32::{self, FromBase32};

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
/// Kaspa format: `<hrp>:<bech32_payload>`
/// We split on `:`, prepend a dummy HRP `x1` so bech32 0.9 can decode it,
/// then convert the 5-bit groups to bytes.
fn addr_to_hash160(addr: &str) -> Result<[u8; 20], String> {
    if addr == "open" || addr.is_empty() || addr == "kaspatest:open" {
        return Ok([0u8; 20]);
    }

    // Split "kaspatest:qpx6..." -> payload = "qpx6..."
    let colon = addr.find(':')
        .ok_or_else(|| format!("invalid kaspa address (no ':'): {}", addr))?;
    let payload_str = &addr[colon + 1..];

    // Re-encode as standard bech32: "x1<payload>" so bech32 0.9 decode() works.
    // bech32 0.9 decode() expects "<hrp>1<data+checksum>"
    let standard = format!("x1{}", payload_str);
    let (_hrp, data5, _variant) = bech32::decode(&standard)
        .map_err(|e| format!("bech32 decode failed for '{}': {}", addr, e))?;

    let all_bytes = Vec::<u8>::from_base32(&data5)
        .map_err(|e| format!("base32->bytes failed: {}", e))?;

    if all_bytes.is_empty() {
        return Err(format!("empty payload for: {}", addr));
    }

    // byte[0] = version: 0x08 = P2SH, else P2PK
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
