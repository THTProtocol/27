//! htp-server — proof commit module
//!
//! SHA-256 sequential-chain move-log commit builder.
//! Implements HTP narrow verification: h0 = SHA(move0), h(i+1) = SHA(hi + move_i+1).
//! Returns canonical proof commit structs with serde serialization.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// A single move in a skill game
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMove {
    pub from: String,
    pub to: String,
    pub piece: Option<String>,
    pub player: u8,
    pub timestamp: Option<u64>,
}

impl GameMove {
    pub fn canonical_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }
}

/// Proof commit output — the canonical narrow-verification proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofCommit {
    pub match_id: String,
    pub root: String, // final SHA-256 hash of the sequential chain
    pub move_count: usize,
    pub winner: String,
    pub game_type: String,
    pub timestamp: u64,
    pub proof_system: String,
}

/// Builder for sequential-chain move-log commitments
pub struct MoveCommitBuilder {
    moves: Vec<GameMove>,
}

impl MoveCommitBuilder {
    pub fn new() -> Self {
        Self { moves: vec![] }
    }

    pub fn with_capacity(cap: usize) -> Self {
        Self {
            moves: Vec::with_capacity(cap),
        }
    }

    pub fn push(&mut self, mv: GameMove) {
        self.moves.push(mv);
    }

    pub fn extend(&mut self, moves: impl IntoIterator<Item = GameMove>) {
        self.moves.extend(moves);
    }

    /// Build the sequential chain commitment
    ///
    /// h0 = SHA(move0)
    /// h1 = SHA(h0 || move1)
    /// ...
    pub fn build(&self) -> Option<String> {
        if self.moves.is_empty() {
            return None;
        }

        let mut latest: Option<Vec<u8>> = None;

        for mv in &self.moves {
            let mv_bytes = mv.canonical_bytes();

            let input = if let Some(ref prev) = latest {
                // hi = SHA(prev || move_i)
                let mut combined = prev.clone();
                combined.extend_from_slice(&mv_bytes);
                combined
            } else {
                // h0 = SHA(move0)
                mv_bytes
            };

            let mut hasher = Sha256::new();
            hasher.update(&input);
            latest = Some(hasher.finalize().to_vec());
        }

        latest.map(|hash| hex::encode(hash))
    }

    pub fn move_count(&self) -> usize {
        self.moves.len()
    }
}

impl Default for MoveCommitBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Build a full proof commit from a sequence of moves
pub fn build_proof(
    match_id: &str,
    moves: &[GameMove],
    winner: &str,
    game_type: &str,
) -> Option<ProofCommit> {
    let mut builder = MoveCommitBuilder::with_capacity(moves.len());
    builder.extend(moves.iter().cloned());

    let root = builder.build()?;

    Some(ProofCommit {
        match_id: match_id.to_string(),
        root,
        move_count: builder.move_count(),
        winner: winner.to_string(),
        game_type: game_type.to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        proof_system: "sha256-sequential-chain".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_move(from: &str, to: &str, player: u8) -> GameMove {
        GameMove {
            from: from.into(),
            to: to.into(),
            piece: None,
            player,
            timestamp: Some(1000),
        }
    }

    #[test]
    fn empty_builder_returns_none() {
        let builder = MoveCommitBuilder::new();
        assert!(builder.build().is_none());
    }

    #[test]
    fn single_move_produces_hash() {
        let mut builder = MoveCommitBuilder::new();
        builder.push(sample_move("e2", "e4", 1));
        let root = builder.build().unwrap();
        assert_eq!(root.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn deterministic_commit() {
        let mut b1 = MoveCommitBuilder::new();
        let mut b2 = MoveCommitBuilder::new();

        for mv in [sample_move("e2", "e4", 1), sample_move("e7", "e5", 2)] {
            b1.push(mv.clone());
            b2.push(mv);
        }

        assert_eq!(b1.build(), b2.build());
    }

    #[test]
    fn different_order_gives_different_root() {
        let mut b1 = MoveCommitBuilder::new();
        let mut b2 = MoveCommitBuilder::new();

        b1.push(sample_move("e2", "e4", 1));
        b1.push(sample_move("e7", "e5", 2));

        b2.push(sample_move("e7", "e5", 2));
        b2.push(sample_move("e2", "e4", 1));

        assert_ne!(b1.build(), b2.build());
    }

    #[test]
    fn build_proof_roundtrip() {
        let moves = vec![
            sample_move("e2", "e4", 1),
            sample_move("e7", "e5", 2),
            sample_move("g1", "f3", 1),
        ];
        let proof = build_proof("match-1", &moves, "kaspatest:abc", "chess").unwrap();
        assert_eq!(proof.move_count, 3);
        assert_eq!(proof.root.len(), 64);
        assert_eq!(proof.proof_system, "sha256-sequential-chain");

        let json = serde_json::to_string(&proof).unwrap();
        let back: ProofCommit = serde_json::from_str(&json).unwrap();
        assert_eq!(back.root, proof.root);
    }
}
