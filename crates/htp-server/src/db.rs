// db.rs — SQLite persistence for High Table Protocol server
// Tables: games, covenants, settlements, move_log
// Uses rusqlite with bundled SQLite (no system dep)

use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

fn now_secs() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64
}

pub struct HtpDb {
    pub conn: Connection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRecord {
    pub id:          String,
    pub game_type:   String,
    pub creator:     String,
    pub opponent:    Option<String>,
    pub stake_sompi: u64,
    pub status:      String,
    pub winner:      Option<String>,
    pub proof_root:  Option<String>,
    pub covenant_id: Option<String>,
    pub created_at:  i64,
    pub updated_at:  i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementRecord {
    pub game_id:          String,
    pub winner:           String,
    pub attestation_hash: String,
    pub arbiter:          String,
    pub settlement_path:  String,
    pub status:           String,
    pub proposed_at:      i64,
    pub finalized_at:     Option<i64>,
    pub dispute_deadline: i64,
    pub disputed_by:      Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CovenantDbRecord {
    pub id:            String,
    pub covenant_type: String,
    pub game_id:       String,
    pub creator:       String,
    pub opponent:      Option<String>,
    pub stake_sompi:   u64,
    pub utxo_txid:     Option<String>,
    pub utxo_index:    Option<u32>,
    pub status:        String,
    pub script_hash:   String,
    pub created_at:    i64,
    pub updated_at:    i64,
}

impl HtpDb {
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;"
        )?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS games (
                id          TEXT PRIMARY KEY,
                game_type   TEXT NOT NULL DEFAULT 'SkillGame',
                creator     TEXT NOT NULL DEFAULT '',
                opponent    TEXT,
                stake_sompi INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL DEFAULT 'OPEN',
                winner      TEXT,
                proof_root  TEXT,
                covenant_id TEXT,
                created_at  INTEGER NOT NULL DEFAULT 0,
                updated_at  INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS covenants (
                id            TEXT PRIMARY KEY,
                covenant_type TEXT NOT NULL DEFAULT 'SkillGame',
                game_id       TEXT NOT NULL DEFAULT '',
                creator       TEXT NOT NULL DEFAULT '',
                opponent      TEXT,
                stake_sompi   INTEGER NOT NULL DEFAULT 0,
                utxo_txid     TEXT,
                utxo_index    INTEGER,
                status        TEXT NOT NULL DEFAULT 'PENDING',
                script_hash   TEXT NOT NULL DEFAULT '',
                created_at    INTEGER NOT NULL DEFAULT 0,
                updated_at    INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settlements (
                game_id          TEXT PRIMARY KEY,
                winner           TEXT NOT NULL DEFAULT '',
                attestation_hash TEXT NOT NULL DEFAULT '',
                arbiter          TEXT NOT NULL DEFAULT '',
                settlement_path  TEXT NOT NULL DEFAULT 'B',
                status           TEXT NOT NULL DEFAULT 'PENDING_SETTLE',
                proposed_at      INTEGER NOT NULL DEFAULT 0,
                finalized_at     INTEGER,
                dispute_deadline INTEGER NOT NULL DEFAULT 0,
                disputed_by      TEXT
            );
            CREATE TABLE IF NOT EXISTS move_log (
                game_id    TEXT NOT NULL,
                move_index INTEGER NOT NULL,
                move_data  TEXT NOT NULL DEFAULT '',
                player     TEXT NOT NULL DEFAULT '',
                timestamp  INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (game_id, move_index)
            );
            CREATE INDEX IF NOT EXISTS idx_games_status  ON games(status);
            CREATE INDEX IF NOT EXISTS idx_games_creator ON games(creator);
            CREATE INDEX IF NOT EXISTS idx_cov_game      ON covenants(game_id);
            CREATE INDEX IF NOT EXISTS idx_moves_game    ON move_log(game_id);
        ")?;
        Ok(())
    }

    // ── Games ─────────────────────────────────────────────────────

    pub fn upsert_game(&self, g: &GameRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO games
             (id,game_type,creator,opponent,stake_sompi,status,winner,proof_root,covenant_id,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(id) DO UPDATE SET
               opponent=excluded.opponent, status=excluded.status,
               winner=excluded.winner, proof_root=excluded.proof_root,
               covenant_id=excluded.covenant_id, updated_at=excluded.updated_at",
            params![g.id, g.game_type, g.creator, g.opponent,
                    g.stake_sompi as i64, g.status, g.winner,
                    g.proof_root, g.covenant_id, g.created_at, g.updated_at],
        )?;
        Ok(())
    }

    pub fn get_game(&self, id: &str) -> Result<Option<GameRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,game_type,creator,opponent,stake_sompi,status,winner,proof_root,covenant_id,created_at,updated_at
             FROM games WHERE id=?1")?;
        let mut rows = stmt.query(params![id])?;
        Ok(rows.next()?.map(|row| GameRecord {
            id:          row.get(0).unwrap_or_default(),
            game_type:   row.get(1).unwrap_or_default(),
            creator:     row.get(2).unwrap_or_default(),
            opponent:    row.get(3).unwrap_or_default(),
            stake_sompi: row.get::<_,i64>(4).unwrap_or(0) as u64,
            status:      row.get(5).unwrap_or_default(),
            winner:      row.get(6).unwrap_or_default(),
            proof_root:  row.get(7).unwrap_or_default(),
            covenant_id: row.get(8).unwrap_or_default(),
            created_at:  row.get(9).unwrap_or(0),
            updated_at:  row.get(10).unwrap_or(0),
        }))
    }

    pub fn list_games(&self, status_filter: Option<&str>) -> Result<Vec<GameRecord>> {
        let (sql, params_list): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(s) = status_filter {
            ("SELECT id,game_type,creator,opponent,stake_sompi,status,winner,proof_root,covenant_id,created_at,updated_at
              FROM games WHERE status=?1 ORDER BY created_at DESC LIMIT 200",
             vec![Box::new(s.to_string())])
        } else {
            ("SELECT id,game_type,creator,opponent,stake_sompi,status,winner,proof_root,covenant_id,created_at,updated_at
              FROM games ORDER BY created_at DESC LIMIT 200",
             vec![])
        };
        let mut stmt = self.conn.prepare(sql)?;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_list.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| Ok(GameRecord {
            id:          row.get(0)?, game_type:   row.get(1)?, creator:     row.get(2)?,
            opponent:    row.get(3)?, stake_sompi: row.get::<_,i64>(4)? as u64,
            status:      row.get(5)?, winner:      row.get(6)?, proof_root:  row.get(7)?,
            covenant_id: row.get(8)?, created_at:  row.get(9)?, updated_at:  row.get(10)?,
        }))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn set_game_status(&self, id: &str, status: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE games SET status=?1, updated_at=?2 WHERE id=?3",
            params![status, now_secs(), id],
        )?;
        Ok(())
    }

    pub fn set_game_winner(&self, id: &str, winner: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE games SET winner=?1, status='SETTLED', updated_at=?2 WHERE id=?3",
            params![winner, now_secs(), id],
        )?;
        Ok(())
    }

    // ── Settlements ───────────────────────────────────────────────

    pub fn upsert_settlement(&self, s: &SettlementRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settlements
             (game_id,winner,attestation_hash,arbiter,settlement_path,status,proposed_at,finalized_at,dispute_deadline,disputed_by)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
             ON CONFLICT(game_id) DO UPDATE SET
               status=excluded.status, finalized_at=excluded.finalized_at,
               disputed_by=excluded.disputed_by",
            params![s.game_id, s.winner, s.attestation_hash, s.arbiter,
                    s.settlement_path, s.status, s.proposed_at,
                    s.finalized_at, s.dispute_deadline, s.disputed_by],
        )?;
        Ok(())
    }

    pub fn get_settlement(&self, game_id: &str) -> Result<Option<SettlementRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT game_id,winner,attestation_hash,arbiter,settlement_path,status,proposed_at,finalized_at,dispute_deadline,disputed_by
             FROM settlements WHERE game_id=?1")?;
        let mut rows = stmt.query(params![game_id])?;
        Ok(rows.next()?.map(|row| SettlementRecord {
            game_id:          row.get(0).unwrap_or_default(),
            winner:           row.get(1).unwrap_or_default(),
            attestation_hash: row.get(2).unwrap_or_default(),
            arbiter:          row.get(3).unwrap_or_default(),
            settlement_path:  row.get(4).unwrap_or_default(),
            status:           row.get(5).unwrap_or_default(),
            proposed_at:      row.get(6).unwrap_or(0),
            finalized_at:     row.get(7).unwrap_or_default(),
            dispute_deadline: row.get(8).unwrap_or(0),
            disputed_by:      row.get(9).unwrap_or_default(),
        }))
    }

    pub fn dispute_settlement(&self, game_id: &str, challenger: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE settlements SET status='DISPUTED', disputed_by=?1 WHERE game_id=?2",
            params![challenger, game_id],
        )?;
        Ok(())
    }

    pub fn finalize_settlement(&self, game_id: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE settlements SET status='SETTLED', finalized_at=?1 WHERE game_id=?2",
            params![now_secs(), game_id],
        )?;
        Ok(())
    }

    // ── Move log ──────────────────────────────────────────────────

    pub fn append_move(&self, game_id: &str, move_index: u64, move_data: &str, player: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO move_log (game_id,move_index,move_data,player,timestamp)
             VALUES (?1,?2,?3,?4,?5)",
            params![game_id, move_index as i64, move_data, player, now_secs()],
        )?;
        Ok(())
    }

    pub fn get_moves(&self, game_id: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT move_data FROM move_log WHERE game_id=?1 ORDER BY move_index ASC")?;
        let iter = stmt.query_map(params![game_id], |row| row.get(0))?;
        Ok(iter.filter_map(|r| r.ok()).collect())
    }

    pub fn count_moves(&self, game_id: &str) -> Result<u64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM move_log WHERE game_id=?1",
            params![game_id],
            |row| row.get(0),
        ).unwrap_or(0);
        Ok(count as u64)
    }

    // ── Covenants ─────────────────────────────────────────────────

    pub fn upsert_covenant(&self, c: &CovenantDbRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO covenants
             (id,covenant_type,game_id,creator,opponent,stake_sompi,utxo_txid,utxo_index,status,script_hash,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
             ON CONFLICT(id) DO UPDATE SET
               opponent=excluded.opponent, utxo_txid=excluded.utxo_txid,
               utxo_index=excluded.utxo_index, status=excluded.status,
               updated_at=excluded.updated_at",
            params![c.id, c.covenant_type, c.game_id, c.creator, c.opponent,
                    c.stake_sompi as i64, c.utxo_txid, c.utxo_index.map(|i| i as i64),
                    c.status, c.script_hash, c.created_at, now_secs()],
        )?;
        Ok(())
    }

    pub fn get_covenant_by_game(&self, game_id: &str) -> Result<Option<CovenantDbRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,covenant_type,game_id,creator,opponent,stake_sompi,utxo_txid,utxo_index,status,script_hash,created_at,updated_at
             FROM covenants WHERE game_id=?1 LIMIT 1")?;
        let mut rows = stmt.query(params![game_id])?;
        Ok(rows.next()?.map(|row| CovenantDbRecord {
            id:            row.get(0).unwrap_or_default(),
            covenant_type: row.get(1).unwrap_or_default(),
            game_id:       row.get(2).unwrap_or_default(),
            creator:       row.get(3).unwrap_or_default(),
            opponent:      row.get(4).unwrap_or_default(),
            stake_sompi:   row.get::<_,i64>(5).unwrap_or(0) as u64,
            utxo_txid:     row.get(6).unwrap_or_default(),
            utxo_index:    row.get::<_,Option<i64>>(7).unwrap_or(None).map(|i| i as u32),
            status:        row.get(8).unwrap_or_default(),
            script_hash:   row.get(9).unwrap_or_default(),
            created_at:    row.get(10).unwrap_or(0),
            updated_at:    row.get(11).unwrap_or(0),
        }))
    }

    pub fn execute_raw(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<usize> {
        self.conn.execute(sql, params)
    }
}
