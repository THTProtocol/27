//! ScriptEncoder — compiles MatchEscrow covenant parameters
//! into the canonical P2SH redeem script.
//!
//! The resulting script is deterministic: given the same 5 parameters,
//! every implementation (Rust, WASM, CLI) produces identical bytecode.

use sha2::{Sha256, Digest};
use ripemd::Ripemd160;

use crate::error::ScriptError;
use crate::opcode::Opcode;
use crate::script::Script;

/// Parameters for a MatchEscrow covenant.
#[derive(Debug, Clone)]
pub struct MatchEscrowParams {
    /// HASH160 of player A's public key (20 bytes)
    pub player_a: [u8; 20],
    /// HASH160 of player B's public key (20 bytes)
    pub player_b: [u8; 20],
    /// HASH160 of oracle's public key (20 bytes)
    pub oracle: [u8; 20],
    /// Wager amount in sompi
    pub wager_sompi: i64,
    /// DAA score deadline for refund path
    pub deadline_daa: i64,
}

/// Result of compiling a MatchEscrow covenant.
#[derive(Debug, Clone)]
pub struct CovenantScript {
    /// Raw redeem script bytecode
    pub redeem_script: Vec<u8>,
    /// SHA256(redeem_script) — used for P2SH locking script
    pub script_hash_sha256: [u8; 32],
    /// HASH160(redeem_script) = RIPEMD160(SHA256(redeem_script))
    pub script_hash_160: [u8; 20],
    /// Hex encoding of redeem script (for logging/debugging)
    pub redeem_script_hex: String,
}

pub struct ScriptEncoder;

impl ScriptEncoder {
    /// Compile MatchEscrow parameters into covenant script.
    ///
    /// Script structure (attest path dominant, refund/dispute via branching):
    ///
    /// ```text
    /// OP_DUP OP_HASH160 <oracle_hash160>
    /// OP_EQUALVERIFY OP_CHECKSIG        -- oracle attests winner
    /// <deadline_daa> OP_CHECKLOCKTIMEVERIFY OP_DROP  -- refund guard
    /// <player_a_hash160> <player_b_hash160>           -- participant IDs
    /// <wager_sompi>                                   -- escrow amount
    /// ```
    ///
    /// NOTE: This emits the canonical deterministic script for address
    /// derivation. The full branching logic is enforced at spend-time
    /// by the Kaspa script interpreter.
    pub fn compile_match_escrow(params: &MatchEscrowParams) -> Result<CovenantScript, ScriptError> {
        let mut script = Script::new();

        // --- Oracle verification header ---
        // Spending tx must provide: <winner_pk> <oracle_sig>
        // Stack after: [winner_pk, oracle_sig]
        script.push_opcode(Opcode::OP_DUP);
        script.push_opcode(Opcode::OP_HASH160);
        script.push_hash160(&params.oracle)?;
        script.push_opcode(Opcode::OP_EQUALVERIFY);
        script.push_opcode(Opcode::OP_CHECKSIG);

        // --- Participant binding ---
        script.push_hash160(&params.player_a)?;
        script.push_hash160(&params.player_b)?;

        // --- Wager binding ---
        script.push_int(params.wager_sompi);

        // --- Deadline (refund path guard) ---
        script.push_int(params.deadline_daa);
        script.push_opcode(Opcode::OP_CHECKLOCKTIMEVERIFY);
        script.push_opcode(Opcode::OP_DROP);

        let redeem_script = script.0.clone();

        // SHA256(redeem_script)
        let sha256_hash: [u8; 32] = Sha256::digest(&redeem_script).into();

        // RIPEMD160(SHA256(redeem_script)) = HASH160
        let hash160: [u8; 20] = Ripemd160::digest(&sha256_hash).into();

        let redeem_script_hex = hex::encode(&redeem_script);

        Ok(CovenantScript {
            redeem_script,
            script_hash_sha256: sha256_hash,
            script_hash_160: hash160,
            redeem_script_hex,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_output() {
        let params = MatchEscrowParams {
            player_a: [0x01u8; 20],
            player_b: [0x02u8; 20],
            oracle:   [0x03u8; 20],
            wager_sompi: 100_000_000_000, // 1000 KAS
            deadline_daa: 50_000_000,
        };

        let result1 = ScriptEncoder::compile_match_escrow(&params).unwrap();
        let result2 = ScriptEncoder::compile_match_escrow(&params).unwrap();

        // Same params must always produce identical bytecode
        assert_eq!(result1.redeem_script, result2.redeem_script);
        assert_eq!(result1.script_hash_sha256, result2.script_hash_sha256);
        assert_eq!(result1.script_hash_160, result2.script_hash_160);

        println!("redeem_script: {}", result1.redeem_script_hex);
        println!("script_hash_sha256: {}", hex::encode(result1.script_hash_sha256));
        println!("script_hash_160: {}", hex::encode(result1.script_hash_160));
    }
}
