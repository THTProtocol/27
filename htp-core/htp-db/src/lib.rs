//! HTP Database — SQLite-backed persistent storage.
//! Ports the in-memory JSON file Database from lib/db.js.
//!
//! Schema: games, markets, users, config tables.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, DbError>;

/// Core database handle. Thread-safe via internal Mutex.
pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub game_type: String,
    pub player_a: String,
    pub player_b: Option<String>,
    pub stake_sompi: i64,
    pub escrow_txid: Option<String>,
    pub settle_txid: Option<String>,
    pub escrow_script_hex: Option<String>,
    pub status: String,
    pub winner: Option<String>,
    pub board_state: Option<String>,
    pub moves_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub status: String,
    pub creator_addr: String,
    pub side_a_total: i64,
    pub side_b_total: i64,
    pub resolution_outcome: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub addr: String,
    pub pubkey: Option<String>,
    pub total_games: i64,
    pub games_won: i64,
    pub total_bets: i64,
    pub total_wagered: i64,
    pub total_won: i64,
}

impl Database {
    /// Open or create the SQLite database at the given path.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Self::migrate(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    fn migrate(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS games (
                id                TEXT PRIMARY KEY,
                game_type         TEXT NOT NULL,
                player_a          TEXT NOT NULL,
                player_b          TEXT,
                stake_sompi       INTEGER NOT NULL DEFAULT 0,
                escrow_txid       TEXT,
                settle_txid       TEXT,
                escrow_script_hex TEXT,
                status            TEXT NOT NULL DEFAULT 'waiting',
                winner            TEXT,
                board_state       TEXT,
                moves_json        TEXT,
                created_at        TEXT NOT NULL,
                updated_at        TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS markets (
                id                  TEXT PRIMARY KEY,
                title               TEXT NOT NULL DEFAULT '',
                description         TEXT NOT NULL DEFAULT '',
                category            TEXT NOT NULL DEFAULT 'custom',
                status              TEXT NOT NULL DEFAULT 'open',
                creator_addr        TEXT NOT NULL,
                side_a_total        INTEGER NOT NULL DEFAULT 0,
                side_b_total        INTEGER NOT NULL DEFAULT 0,
                resolution_outcome  TEXT
            );
            CREATE TABLE IF NOT EXISTS users (
                addr          TEXT PRIMARY KEY,
                pubkey        TEXT,
                total_games   INTEGER NOT NULL DEFAULT 0,
                games_won     INTEGER NOT NULL DEFAULT 0,
                total_bets    INTEGER NOT NULL DEFAULT 0,
                total_wagered INTEGER NOT NULL DEFAULT 0,
                total_won     INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settlements (
                hash TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                txid TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
            CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
            "
        )?;
        Ok(())
    }

    // ─── Config ──────────────────────────────────────────────

    pub fn get_config(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT value FROM config WHERE key = ?1",
            params![key],
            |row| row.get(0),
        ).ok()
    }

    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_protocol_address(&self) -> String {
        self.get_config("protocolAddress")
            .unwrap_or_else(|| "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m".into())
    }

    // ─── Games ──────────────────────────────────────────────

    pub fn create_game(&self, g: &Game) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO games (id, game_type, player_a, player_b, stake_sompi, escrow_txid,
             escrow_script_hex, status, winner, board_state, moves_json, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
            params![
                g.id, g.game_type, g.player_a, g.player_b, g.stake_sompi,
                g.escrow_txid, g.escrow_script_hex, g.status, g.winner,
                g.board_state, g.moves_json, g.created_at, g.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_game(&self, id: &str) -> Result<Option<Game>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, game_type, player_a, player_b, stake_sompi, escrow_txid,
             settle_txid, escrow_script_hex, status, winner, board_state, moves_json,
             created_at, updated_at FROM games WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], Self::row_to_game)?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn update_game(&self, id: &str, status: Option<&str>, winner: Option<&str>,
                       settle_txid: Option<&str>, board_state: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE games SET
                status = COALESCE(?2, status),
                winner = COALESCE(?3, winner),
                settle_txid = COALESCE(?4, settle_txid),
                board_state = COALESCE(?5, board_state),
                updated_at = ?6
             WHERE id = ?1",
            params![id, status, winner, settle_txid, board_state, now],
        )?;
        Ok(())
    }

    pub fn get_all_games(&self) -> Result<Vec<Game>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, game_type, player_a, player_b, stake_sompi, escrow_txid,
             settle_txid, escrow_script_hex, status, winner, board_state, moves_json,
             created_at, updated_at FROM games ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], Self::row_to_game)?;
        let mut games = Vec::new();
        for r in rows { games.push(r?); }
        Ok(games)
    }

    // ─── Settlements (idempotency) ─────────────────────────

    pub fn check_settlement(&self, hash: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.query_row(
            "SELECT txid FROM settlements WHERE hash = ?1",
            params![hash],
            |row| row.get(0),
        ).ok())
    }

    pub fn record_settlement(&self, hash: &str, game_id: &str, txid: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR IGNORE INTO settlements (hash, game_id, txid, created_at) VALUES (?1,?2,?3,?4)",
            params![hash, game_id, txid, now],
        )?;
        Ok(())
    }

    // ─── Users ──────────────────────────────────────────────

    pub fn get_or_create_user(&self, addr: &str) -> Result<User> {
        let conn = self.conn.lock().unwrap();
        match conn.query_row(
            "SELECT addr, pubkey, total_games, games_won, total_bets, total_wagered, total_won
             FROM users WHERE addr = ?1",
            params![addr],
            Self::row_to_user,
        ) {
            Ok(u) => Ok(u),
            Err(_) => {
                let u = User {
                    addr: addr.to_string(), pubkey: None, total_games: 0,
                    games_won: 0, total_bets: 0, total_wagered: 0, total_won: 0,
                };
                conn.execute(
                    "INSERT INTO users (addr) VALUES (?1)",
                    params![addr],
                )?;
                Ok(u)
            }
        }
    }

    pub fn update_user(&self, addr: &str, pubkey: Option<&str>,
                       total_games: Option<i64>, games_won: Option<i64>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE users SET pubkey = COALESCE(?2, pubkey),
             total_games = COALESCE(?3, total_games),
             games_won = COALESCE(?4, games_won)
             WHERE addr = ?1",
            params![addr, pubkey, total_games, games_won],
        )?;
        Ok(())
    }

    // ─── Row mappers ────────────────────────────────────────

    fn row_to_game(row: &rusqlite::Row) -> rusqlite::Result<Game> {
        Ok(Game {
            id: row.get(0)?, game_type: row.get(1)?,
            player_a: row.get(2)?, player_b: row.get(3)?,
            stake_sompi: row.get(4)?, escrow_txid: row.get(5)?,
            settle_txid: row.get(6)?, escrow_script_hex: row.get(7)?,
            status: row.get(8)?, winner: row.get(9)?,
            board_state: row.get(10)?, moves_json: row.get(11)?,
            created_at: row.get(12)?, updated_at: row.get(13)?,
        })
    }

    fn row_to_user(row: &rusqlite::Row) -> rusqlite::Result<User> {
        Ok(User {
            addr: row.get(0)?, pubkey: row.get(1)?,
            total_games: row.get(2)?, games_won: row.get(3)?,
            total_bets: row.get(4)?, total_wagered: row.get(5)?,
            total_won: row.get(6)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_and_config() {
        let db = Database::open(":memory:").unwrap();
        db.set_config("test_key", "test_value").unwrap();
        assert_eq!(db.get_config("test_key"), Some("test_value".into()));
        assert_eq!(db.get_config("nonexistent"), None);
    }

    #[test]
    fn test_create_and_get_game() {
        let db = Database::open(":memory:").unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let g = Game {
            id: "game-1".into(), game_type: "tictactoe".into(),
            player_a: "addr-a".into(), player_b: None,
            stake_sompi: 1000000, escrow_txid: None, settle_txid: None,
            escrow_script_hex: None, status: "waiting".into(),
            winner: None, board_state: None, moves_json: None,
            created_at: now.clone(), updated_at: now,
        };
        db.create_game(&g).unwrap();
        let got = db.get_game("game-1").unwrap().unwrap();
        assert_eq!(got.id, "game-1");
        assert_eq!(got.game_type, "tictactoe");
    }

    #[test]
    fn test_settlement_idempotency() {
        let db = Database::open(":memory:").unwrap();
        let hash = "abc123";
        assert!(db.check_settlement(hash).unwrap().is_none());
        db.record_settlement(hash, "g1", "tx1").unwrap();
        assert_eq!(db.check_settlement(hash).unwrap(), Some("tx1".into()));
    }
}