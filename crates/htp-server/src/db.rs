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
            

        // ═══════════════════════════════════════════
        // HTP ORACLE NETWORK TABLES
        // ═══════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS htp_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            creator_address TEXT NOT NULL DEFAULT '',
            oracle_type TEXT NOT NULL DEFAULT 'oracle',
            resolution_url TEXT NOT NULL DEFAULT '',
            resolution_json_path TEXT NOT NULL DEFAULT '$.result',
            resolution_condition TEXT NOT NULL DEFAULT '',
            resolution_daa INTEGER NOT NULL DEFAULT 0,
            quorum_m INTEGER NOT NULL DEFAULT 2,
            quorum_n INTEGER NOT NULL DEFAULT 3,
            challenge_window_sec INTEGER NOT NULL DEFAULT 172800,
            protocol_fee_bps INTEGER NOT NULL DEFAULT 200,
            status TEXT NOT NULL DEFAULT 'open',
            outcome TEXT,
            outcome_attested_at INTEGER,
            gross_pot_sompi INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            resolved_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS htp_oracle_operators (
            pubkey TEXT PRIMARY KEY,
            nickname TEXT DEFAULT 'anon',
            bond_txid TEXT DEFAULT '',
            bond_sompi INTEGER NOT NULL DEFAULT 0,
            slash_count INTEGER NOT NULL DEFAULT 0,
            correct_count INTEGER NOT NULL DEFAULT 0,
            reputation REAL NOT NULL DEFAULT 1.0,
            is_active INTEGER NOT NULL DEFAULT 1,
            operator_type TEXT NOT NULL DEFAULT 'oracle',
            registered_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            last_active_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS htp_attestations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            attestor_pubkey TEXT NOT NULL,
            attestor_type TEXT NOT NULL DEFAULT 'oracle',
            resolution_value TEXT NOT NULL DEFAULT '',
            signed_outcome TEXT NOT NULL,
            attestation_hash TEXT NOT NULL,
            signature TEXT NOT NULL,
            daa_score INTEGER NOT NULL DEFAULT 0,
            submitted_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            UNIQUE(event_id, attestor_pubkey)
        );

        CREATE TABLE IF NOT EXISTS htp_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            attestation_id INTEGER NOT NULL,
            challenger_pubkey TEXT NOT NULL,
            challenger_stake_sompi INTEGER NOT NULL DEFAULT 0,
            wrong_attestor_pubkey TEXT NOT NULL,
            proof_type TEXT NOT NULL DEFAULT 'counter_url',
            proof_data TEXT NOT NULL DEFAULT '{}',
            counter_outcome TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            bond_slashed_sompi INTEGER NOT NULL DEFAULT 0,
            challenger_reward_sompi INTEGER NOT NULL DEFAULT 0,
            protocol_fee_sompi INTEGER NOT NULL DEFAULT 0,
            slash_txid TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            resolved_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS htp_zk_proofs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            proof_system TEXT NOT NULL DEFAULT 'risc_zero',
            circuit_commitment TEXT NOT NULL DEFAULT '',
            public_inputs_json TEXT NOT NULL DEFAULT '{}',
            proof_bytes_hex TEXT NOT NULL DEFAULT '',
            signed_outcome TEXT NOT NULL,
            resolution_value TEXT NOT NULL DEFAULT '',
            verification_status TEXT NOT NULL DEFAULT 'pending',
            kip16_opcode TEXT NOT NULL DEFAULT 'OP_ZK_RISC0_VERIFY',
            verified_txid TEXT,
            submitted_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            verified_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS htp_protocol_fees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            fee_type TEXT NOT NULL DEFAULT 'settlement',
            gross_sompi INTEGER NOT NULL DEFAULT 0,
            fee_bps INTEGER NOT NULL DEFAULT 200,
            fee_sompi INTEGER NOT NULL DEFAULT 0,
            net_sompi INTEGER NOT NULL DEFAULT 0,
            collected_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
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


    pub fn set_game_opponent(&self, id: &str, opponent: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE games SET opponent = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, opponent, std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64],
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


    // ═══════════════════════════════════════════════════════
    // Oracle Network helpers
    // ═══════════════════════════════════════════════════════
    pub fn create_event_db(
        &self, id: &str, title: &str, creator: &str,
        oracle_type: &str, url: &str, json_path: &str,
        condition: &str, resolution_daa: i64, quorum_m: i64, quorum_n: i64,
    ) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO htp_events (id,title,creator_address,oracle_type,resolution_url,resolution_json_path,resolution_condition,resolution_daa,quorum_m,quorum_n) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            rusqlite::params![id, title, creator, oracle_type, url, json_path, condition, resolution_daa, quorum_m, quorum_n],
        )?;
        Ok(())
    }

    pub fn get_open_events(&self) -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,title,oracle_type,resolution_url,resolution_json_path,resolution_condition,resolution_daa,quorum_m,quorum_n,status FROM htp_events WHERE status IN ('open','pending_resolution') ORDER BY resolution_daa ASC LIMIT 100"
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_,String>(0)?,
                "title": r.get::<_,String>(1)?,
                "oracle_type": r.get::<_,String>(2)?,
                "resolution_url": r.get::<_,String>(3)?,
                "resolution_json_path": r.get::<_,String>(4)?,
                "resolution_condition": r.get::<_,String>(5)?,
                "resolution_daa": r.get::<_,i64>(6)?,
                "quorum_m": r.get::<_,i64>(7)?,
                "quorum_n": r.get::<_,i64>(8)?,
                "status": r.get::<_,String>(9)?,
            }))
        })?;
        rows.collect()
    }

    pub fn register_operator_db(
        &self, pubkey: &str, nickname: &str,
        operator_type: &str, bond_txid: &str, bond_sompi: i64,
    ) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO htp_oracle_operators (pubkey,nickname,operator_type,bond_txid,bond_sompi) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(pubkey) DO UPDATE SET bond_sompi=bond_sompi+excluded.bond_sompi, is_active=1, last_active_at=strftime('%s','now')",
            rusqlite::params![pubkey, nickname, operator_type, bond_txid, bond_sompi],
        )?;
        Ok(())
    }

    pub fn get_operator_bond(&self, pubkey: &str) -> rusqlite::Result<i64> {
        self.conn.query_row(
            "SELECT bond_sompi FROM htp_oracle_operators WHERE pubkey=?1",
            rusqlite::params![pubkey],
            |r| r.get(0),
        ).or(Ok(0))
    }

    pub fn submit_attestation_db(
        &self, event_id: &str, pubkey: &str, att_type: &str,
        value: &str, outcome: &str, hash: &str, sig: &str, daa: i64,
    ) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO htp_attestations (event_id,attestor_pubkey,attestor_type,resolution_value,signed_outcome,attestation_hash,signature,daa_score) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            rusqlite::params![event_id, pubkey, att_type, value, outcome, hash, sig, daa],
        )?;
        self.conn.execute(
            "UPDATE htp_oracle_operators SET last_active_at=strftime('%s','now') WHERE pubkey=?1",
            rusqlite::params![pubkey],
        )?;
        Ok(())
    }

    pub fn count_attestations(&self, event_id: &str, outcome: &str) -> rusqlite::Result<i64> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM htp_attestations WHERE event_id=?1 AND signed_outcome=?2",
            rusqlite::params![event_id, outcome],
            |r| r.get(0),
        )
    }

    pub fn check_event_quorum(&self, event_id: &str, quorum_m: i64) -> rusqlite::Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT signed_outcome, COUNT(*) as cnt FROM htp_attestations WHERE event_id=?1 GROUP BY signed_outcome HAVING cnt >= ?2 ORDER BY cnt DESC LIMIT 1"
        )?;
        let mut rows = stmt.query(rusqlite::params![event_id, quorum_m])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get::<_,String>(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn finalize_event_db(&self, event_id: &str, outcome: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE htp_events SET status='attested', outcome=?2, outcome_attested_at=strftime('%s','now') WHERE id=?1",
            rusqlite::params![event_id, outcome],
        )?;
        Ok(())
    }

    pub fn reward_operator_db(&self, pubkey: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE htp_oracle_operators SET correct_count=correct_count+1, reputation=MIN(5.0,reputation+0.05), last_active_at=strftime('%s','now') WHERE pubkey=?1",
            rusqlite::params![pubkey],
        )?;
        Ok(())
    }

    pub fn slash_operator_db(&self, pubkey: &str, slash_sompi: i64) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE htp_oracle_operators SET bond_sompi=MAX(0,bond_sompi-?2), slash_count=slash_count+1, reputation=MAX(0.0,reputation-0.25) WHERE pubkey=?1",
            rusqlite::params![pubkey, slash_sompi],
        )?;
        Ok(())
    }

    pub fn get_attestations_for_event_db(&self, event_id: &str) -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT attestor_pubkey,attestor_type,signed_outcome,attestation_hash,daa_score,submitted_at FROM htp_attestations WHERE event_id=?1 ORDER BY submitted_at ASC"
        )?;
        let rows = stmt.query_map(rusqlite::params![event_id], |r| {
            Ok(serde_json::json!({
                "pubkey": r.get::<_,String>(0)?,
                "type": r.get::<_,String>(1)?,
                "outcome": r.get::<_,String>(2)?,
                "hash": r.get::<_,String>(3)?,
                "daa_score": r.get::<_,i64>(4)?,
                "submitted_at": r.get::<_,i64>(5)?,
            }))
        })?;
        rows.collect()
    }

    pub fn get_operators_db(&self) -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT pubkey,nickname,operator_type,bond_sompi,slash_count,correct_count,reputation,is_active,last_active_at FROM htp_oracle_operators WHERE is_active=1 ORDER BY reputation DESC LIMIT 100"
        )?;
        let rows = stmt.query_map([], |r| {
            let bond: i64 = r.get(3)?;
            Ok(serde_json::json!({
                "pubkey": r.get::<_,String>(0)?,
                "nickname": r.get::<_,String>(1)?,
                "type": r.get::<_,String>(2)?,
                "bond_sompi": bond,
                "bond_kas": bond as f64 / 1e8,
                "slash_count": r.get::<_,i64>(4)?,
                "correct_count": r.get::<_,i64>(5)?,
                "reputation": r.get::<_,f64>(6)?,
                "is_active": r.get::<_,bool>(7)?,
                "last_active_at": r.get::<_,Option<i64>>(8)?,
            }))
        })?;
        rows.collect()
    }

    pub fn get_oracle_network_stats(&self) -> rusqlite::Result<serde_json::Value> {
        let total_events: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_events", [], |r| r.get(0)).unwrap_or(0);
        let open_events: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_events WHERE status='open'", [], |r| r.get(0)).unwrap_or(0);
        let resolved_events: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_events WHERE status IN ('attested','settled')", [], |r| r.get(0)).unwrap_or(0);
        let total_oracles: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_oracle_operators WHERE operator_type='oracle' AND is_active=1", [], |r| r.get(0)).unwrap_or(0);
        let total_arbiters: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_oracle_operators WHERE operator_type='arbiter' AND is_active=1", [], |r| r.get(0)).unwrap_or(0);
        let total_attestations: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_attestations", [], |r| r.get(0)).unwrap_or(0);
        let total_challenges: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_challenges", [], |r| r.get(0)).unwrap_or(0);
        let upheld_challenges: i64 = self.conn.query_row("SELECT COUNT(*) FROM htp_challenges WHERE status='upheld'", [], |r| r.get(0)).unwrap_or(0);
        let total_fees: i64 = self.conn.query_row("SELECT COALESCE(SUM(fee_sompi),0) FROM htp_protocol_fees", [], |r| r.get(0)).unwrap_or(0);
        Ok(serde_json::json!({
            "total_events": total_events,
            "open_events": open_events,
            "resolved_events": resolved_events,
            "total_oracles": total_oracles,
            "total_arbiters": total_arbiters,
            "total_attestations": total_attestations,
            "total_challenges": total_challenges,
            "upheld_challenges": upheld_challenges,
            "total_protocol_fee_sompi": total_fees,
            "protocol_fee_bps": 200
        }))
    }


    pub fn execute_raw(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<usize> {
        self.conn.execute(sql, params)
    }
}
