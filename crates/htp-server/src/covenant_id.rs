//! htp-server — KIP-20 Covenant ID tracker (SQLite-backed)
//!
//! Tracks covenant UTXO lineage for HTP match escrows.
//! KIP-20 assigns each covenant UTXO a stable ID across its lifetime.
//! Maintains persistent server-side registry mapping matchId → covenant chain.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

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

/// SQLite-backed covenant registry (survives pm2 restarts)
pub struct CovenantRegistry {
    conn: Mutex<Connection>,
}

impl CovenantRegistry {
    pub fn new(path: impl AsRef<Path>) -> Self {
        let conn = Connection::open(path).expect("CovenantRegistry: failed to open SQLite");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS covenants (
                match_id      TEXT PRIMARY KEY,
                covenant_id   TEXT NOT NULL,
                creation_txid TEXT NOT NULL,
                current_txid  TEXT NOT NULL,
                generation    INTEGER NOT NULL DEFAULT 0,
                player1       TEXT NOT NULL,
                player2       TEXT NOT NULL,
                stake_sompi   INTEGER NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending'
            );
            PRAGMA journal_mode=WAL;"
        ).expect("CovenantRegistry: migration failed");
        Self { conn: Mutex::new(conn) }
    }

    pub fn register(&self, req: &CovenantRegisterRequest) -> CovenantEntry {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO covenants
             (match_id, covenant_id, creation_txid, current_txid, generation, player1, player2, stake_sompi, status)
             VALUES (?1, ?2, ?3, ?3, 0, ?4, ?5, ?6, 'pending')",
            params![req.match_id, req.covenant_id, req.creation_txid, req.player1, req.player2, req.stake_sompi as i64],
        ).expect("register: insert failed");
        CovenantEntry {
            covenant_id: req.covenant_id.clone(),
            match_id: req.match_id.clone(),
            creation_txid: req.creation_txid.clone(),
            current_txid: req.creation_txid.clone(),
            generation: 0,
            player1: req.player1.clone(),
            player2: req.player2.clone(),
            stake_sompi: req.stake_sompi,
            status: CovenantStatus::Pending,
        }
    }

    pub fn advance(&self, req: &CovenantAdvanceRequest) -> Option<CovenantEntry> {
        let conn = self.conn.lock().unwrap();
        let status_str = serde_variant(&req.new_status);
        let rows = conn.execute(
            "UPDATE covenants SET current_txid = ?1, generation = generation + 1, status = ?2 WHERE match_id = ?3",
            params![req.new_txid, status_str, req.match_id],
        ).ok()?;
        if rows == 0 { return None; }
        // read back inline (avoid deadlock from recursive self.get)
        let mut stmt = conn.prepare(
            "SELECT match_id, covenant_id, creation_txid, current_txid, generation, player1, player2, stake_sompi, status FROM covenants WHERE match_id = ?1"
        ).ok()?;
        stmt.query_row(params![req.match_id], |row| {
            Ok(CovenantEntry {
                match_id: row.get(0)?,
                covenant_id: row.get(1)?,
                creation_txid: row.get(2)?,
                current_txid: row.get(3)?,
                generation: row.get::<_, i64>(4)? as usize,
                player1: row.get(5)?,
                player2: row.get(6)?,
                stake_sompi: row.get::<_, i64>(7)? as u64,
                status: row.get::<_, String>(8)?.parse().unwrap_or(CovenantStatus::Pending),
            })
        }).ok()
    }

    pub fn get(&self, match_id: &str) -> Option<CovenantEntry> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT match_id, covenant_id, creation_txid, current_txid, generation, player1, player2, stake_sompi, status FROM covenants WHERE match_id = ?1"
        ).ok()?;
        let row = stmt.query_row(params![match_id], |row| {
            Ok(CovenantEntry {
                match_id: row.get(0)?,
                covenant_id: row.get(1)?,
                creation_txid: row.get(2)?,
                current_txid: row.get(3)?,
                generation: row.get::<_, i64>(4)? as usize,
                player1: row.get(5)?,
                player2: row.get(6)?,
                stake_sompi: row.get::<_, i64>(7)? as u64,
                status: row.get::<_, String>(8)?.parse().unwrap_or(CovenantStatus::Pending),
            })
        }).ok()?;
        Some(row)
    }

    pub fn list_active(&self) -> Vec<CovenantEntry> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT match_id, covenant_id, creation_txid, current_txid, generation, player1, player2, stake_sompi, status FROM covenants WHERE status = active"
        ).expect("list_active: prepare failed");
        let rows = stmt.query_map([], |row| {
            Ok(CovenantEntry {
                match_id: row.get(0)?,
                covenant_id: row.get(1)?,
                creation_txid: row.get(2)?,
                current_txid: row.get(3)?,
                generation: row.get::<_, i64>(4)? as usize,
                player1: row.get(5)?,
                player2: row.get(6)?,
                stake_sompi: row.get::<_, i64>(7)? as u64,
                status: row.get::<_, String>(8)?.parse().unwrap_or(CovenantStatus::Active),
            })
        }).expect("list_active: query failed");
        rows.filter_map(|r| r.ok()).collect()
    }
}

fn serde_variant<T: Serialize>(v: &T) -> String {
    serde_json::to_value(v)
        .ok()
        .and_then(|jv| jv.as_str().map(String::from))
        .unwrap_or_else(|| "unknown".into())
}

impl std::str::FromStr for CovenantStatus {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, ()> {
        match s {
            "pending" => Ok(CovenantStatus::Pending),
            "active" => Ok(CovenantStatus::Active),
            "settled" => Ok(CovenantStatus::Settled),
            "cancelled" => Ok(CovenantStatus::Cancelled),
            "disputed" => Ok(CovenantStatus::Disputed),
            _ => Err(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_advance_sqlite() {
        let reg = CovenantRegistry::new(":memory:");
        reg.register(&CovenantRegisterRequest {
            match_id: "match-1".into(),
            covenant_id: "cov-abc123".into(),
            creation_txid: "txid-genesis".into(),
            player1: "player1addr".into(),
            player2: "player2addr".into(),
            stake_sompi: 100_000_000,
        });
        // advance to settled
        let entry = reg.advance(&CovenantAdvanceRequest {
            match_id: "match-1".into(),
            new_txid: "txid-settle".into(),
            new_status: CovenantStatus::Settled,
        });
        assert!(entry.is_some());
        let e = entry.unwrap();
        assert_eq!(e.generation, 1);
        assert_eq!(e.status, CovenantStatus::Settled);
        assert_eq!(e.current_txid, "txid-settle");
    }

    #[test]
    fn test_persistence_across_instances() {
        let tmp = std::env::temp_dir().join("htp_cov_test.db");
        let _ = std::fs::remove_file(&tmp);

        let reg1 = CovenantRegistry::new(&tmp);
        reg1.register(&CovenantRegisterRequest {
            match_id: "persist-test".into(),
            covenant_id: "cov-persist".into(),
            creation_txid: "create-tx".into(),
            player1: "p1".into(),
            player2: "p2".into(),
            stake_sompi: 42,
        });
        reg1.advance(&CovenantAdvanceRequest {
            match_id: "persist-test".into(),
            new_txid: "advance-tx".into(),
            new_status: CovenantStatus::Active,
        });
        drop(reg1);

        // Open new instance — data must survive
        let reg2 = CovenantRegistry::new(&tmp);
        let e = reg2.get("persist-test");
        assert!(e.is_some());
        let e = e.unwrap();
        assert_eq!(e.status, CovenantStatus::Active);
        assert_eq!(e.generation, 1);
        assert_eq!(e.current_txid, "advance-tx");
        assert_eq!(e.stake_sompi, 42);

        let _ = std::fs::remove_file(&tmp);
    }

    #[test]
    fn test_list_active_only() {
        let reg = CovenantRegistry::new(":memory:");
        reg.register(&CovenantRegisterRequest {
            match_id: "m1".into(), covenant_id: "c1".into(), creation_txid: "tx1".into(),
            player1: "p1".into(), player2: "p2".into(), stake_sompi: 100,
        });
        reg.advance(&CovenantAdvanceRequest {
            match_id: "m1".into(), new_txid: "tx2".into(), new_status: CovenantStatus::Active,
        });
        reg.register(&CovenantRegisterRequest {
            match_id: "m2".into(), covenant_id: "c2".into(), creation_txid: "tx3".into(),
            player1: "p1".into(), player2: "p3".into(), stake_sompi: 200,
        });
        reg.advance(&CovenantAdvanceRequest {
            match_id: "m2".into(), new_txid: "tx4".into(), new_status: CovenantStatus::Settled,
        });
        let active = reg.list_active();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].match_id, "m1");
    }
}
