//! htp-server — KIP-20 Covenant ID tracker
//!
//! Tracks covenant UTXO lineage for HTP match escrows.
//! KIP-20 assigns each covenant UTXO a stable ID across its lifetime.
//! Maintains server-side registry mapping matchId → covenant chain.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CovenantEntry {
    pub covenant_id: String,
    pub match_id: String,
    pub creation_txid: String,
    pub current_txid: String,
    pub generation: usize,
    pub player1: String,
    pub player2: String,
    pub stake_sompi: u64,
    pub status: CovenantStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CovenantStatus {
    Pending,
    Active,
    Settled,
    Cancelled,
    Disputed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CovenantRegisterRequest {
    pub match_id: String,
    pub covenant_id: String,
    pub creation_txid: String,
    pub player1: String,
    pub player2: String,
    pub stake_sompi: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CovenantAdvanceRequest {
    pub match_id: String,
    pub new_txid: String,
    pub new_status: CovenantStatus,
}

/// In-memory covenant registry (persistent storage via Firebase in prod)
pub struct CovenantRegistry {
    entries: RwLock<HashMap<String, CovenantEntry>>,
}

impl CovenantRegistry {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn register(&self, req: &CovenantRegisterRequest) -> CovenantEntry {
        let entry = CovenantEntry {
            covenant_id: req.covenant_id.clone(),
            match_id: req.match_id.clone(),
            creation_txid: req.creation_txid.clone(),
            current_txid: req.creation_txid.clone(),
            generation: 0,
            player1: req.player1.clone(),
            player2: req.player2.clone(),
            stake_sompi: req.stake_sompi,
            status: CovenantStatus::Pending,
        };
        self.entries
            .write()
            .unwrap()
            .insert(req.match_id.clone(), entry.clone());
        entry
    }

    pub fn advance(&self, req: &CovenantAdvanceRequest) -> Option<CovenantEntry> {
        let mut entries = self.entries.write().unwrap();
        let entry = entries.get_mut(&req.match_id)?;
        entry.current_txid = req.new_txid.clone();
        entry.generation += 1;
        entry.status = req.new_status.clone();
        Some(entry.clone())
    }

    pub fn get(&self, match_id: &str) -> Option<CovenantEntry> {
        self.entries.read().unwrap().get(match_id).cloned()
    }

    pub fn list_active(&self) -> Vec<CovenantEntry> {
        self.entries
            .read()
            .unwrap()
            .values()
            .filter(|e| e.status == CovenantStatus::Active)
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_advance() {
        let reg = CovenantRegistry::new();
        reg.register(&CovenantRegisterRequest {
            match_id: "match-1".into(),
            covenant_id: "cov-abc123".into(),
            creation_txid: "txid-genesis".into(),
            player1: "player1addr".into(),
            player2: "player2addr".into(),
            stake_sompi: 100_000_000,
        });
        let entry = reg.advance(&CovenantAdvanceRequest {
            match_id: "match-1".into(),
            new_txid: "txid-settle".into(),
            new_status: CovenantStatus::Settled,
        });
        assert!(entry.is_some());
        let e = entry.unwrap();
        assert_eq!(e.generation, 1);
        assert_eq!(e.status, CovenantStatus::Settled);
    }

    #[test]
    fn test_list_active_only() {
        let reg = CovenantRegistry::new();
        reg.register(&CovenantRegisterRequest {
            match_id: "m1".into(),
            covenant_id: "c1".into(),
            creation_txid: "tx1".into(),
            player1: "p1".into(),
            player2: "p2".into(),
            stake_sompi: 100,
        });
        reg.advance(&CovenantAdvanceRequest {
            match_id: "m1".into(),
            new_txid: "tx2".into(),
            new_status: CovenantStatus::Active,
        });
        reg.register(&CovenantRegisterRequest {
            match_id: "m2".into(),
            covenant_id: "c2".into(),
            creation_txid: "tx3".into(),
            player1: "p1".into(),
            player2: "p3".into(),
            stake_sompi: 200,
        });
        reg.advance(&CovenantAdvanceRequest {
            match_id: "m2".into(),
            new_txid: "tx4".into(),
            new_status: CovenantStatus::Settled,
        });
        let active = reg.list_active();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].match_id, "m1");
    }
}
