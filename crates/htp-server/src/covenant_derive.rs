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

/// Hash a Kaspa bech32 address to HASH160 (SHA256 then RIPEMD160 of the payload bytes).
/// For P2SH addresses: extract the 20-byte hash directly from the payload.
/// For P2PK addresses: hash the pubkey bytes.
///
/// If the address is "open" or a placeholder, use a zero hash (TBD slot).
fn addr_to_hash160(addr: &str) -> Result<[u8; 20], String> {
    if addr == "open" || addr == "kaspatest:open" || addr.is_empty() {
        return Ok([0u8; 20]); // placeholder — will be replaced when opponent joins
    }

    // Strip the hrp prefix (everything before and including ":")
    let payload_part = if let Some(pos) = addr.rfind(':') {
        &addr[pos + 1..]
    } else {
        addr
    };

    // Decode bech32 — extract the raw payload bytes
    match bech32::decode(addr) {
        Ok((_hrp, data, _variant)) => {
            use bech32::FromBase32;
            let bytes = Vec::<u8>::from_base32(&data)
                .map_err(|e| format!("bech32 base32 decode: {}", e))?;

            if bytes.is_empty() {
                return Err(format!("empty bech32 payload for addr: {}", addr));
            }

            // First byte is the version/type byte in Kaspa:
            //   0x00 = P2PK  (remaining bytes are 32-byte pubkey)
            //   0x08 = P2SH  (remaining 20 bytes are the script hash)
            //   0x01 = P2PK compressed (33 bytes)
            let version = bytes[0];
            let payload = &bytes[1..];

            match version {
                0x08 => {
                    // P2SH: payload IS the 20-byte hash
                    if payload.len() != 20 {
                        return Err(format!("P2SH payload length {} != 20", payload.len()));
                    }
                    let mut arr = [0u8; 20];
                    arr.copy_from_slice(payload);
                    Ok(arr)
                }
                0x00 | 0x01 => {
                    // P2PK: HASH160 the pubkey bytes
                    let sha = Sha256::digest(payload);
                    let h160: [u8; 20] = Ripemd160::digest(&sha).into();
                    Ok(h160)
                }
                _ => {
                    // Unknown version — HASH160 the raw payload
                    let sha = Sha256::digest(payload);
                    let h160: [u8; 20] = Ripemd160::digest(&sha).into();
                    Ok(h160)
                }
            }
        }
        Err(_) => {
            // Not valid bech32 — hash the raw bytes as fallback
            let sha = Sha256::digest(payload_part.as_bytes());
            let h160: [u8; 20] = Ripemd160::digest(&sha).into();
            Ok(h160)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_opponent_gives_zero_hash() {
        let h = addr_to_hash160("open").unwrap();
        assert_eq!(h, [0u8; 20]);
    }

    #[test]
    fn derive_open_game() {
        // Use a known oracle hash160 (all-03 bytes for test)
        let oracle = "0303030303030303030303030303030303030303";
        let result = derive_escrow_address(
            "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj",
            "open",
            oracle,
            100_000_000_000,
            50_000_000,
            "tn12",
        );
        // Should succeed and return a kaspatest: address
        let escrow = result.unwrap();
        assert!(escrow.deposit_address.starts_with("kaspatest"), "addr={}", escrow.deposit_address);
        println!("deposit_address: {}", escrow.deposit_address);
    }
}
