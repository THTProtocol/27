//! HTP ELO Rating System
//! Calculates skill-based ratings for all supported games.
//! K-factor: 32 (<20 games), 24 (<100 games), 16 (100+ games)
//! Starting rating: 1200

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EloRecord {
    pub address: String,
    pub game: String,
    pub rating: f64,
    pub wins: u32,
    pub losses: u32,
    pub draws: u32,
    pub streak: i32,
    pub total_games: u32,
    pub updated_at: String,
}

/// Expected score for player with rating `a` vs opponent with rating `b`.
pub fn expected_score(a: f64, b: f64) -> f64 {
    1.0 / (1.0 + 10_f64.powf((b - a) / 400.0))
}

/// Calculate new ELO rating.
pub fn new_rating(old: f64, actual: f64, expected: f64, k: f64) -> f64 {
    old + k * (actual - expected)
}

/// K-factor based on total games played.
pub fn k_factor(games: u32) -> f64 {
    if games < 20 { 32.0 }
    else if games < 100 { 24.0 }
    else { 16.0 }
}

/// Update winner and loser ratings in-place.
pub fn update_ratings(winner: &mut EloRecord, loser: &mut EloRecord, is_draw: bool) {
    let k_w = k_factor(winner.total_games);
    let k_l = k_factor(loser.total_games);

    let exp_w = expected_score(winner.rating, loser.rating);
    let exp_l = expected_score(loser.rating, winner.rating);

    let (actual_w, actual_l) = if is_draw {
        (0.5, 0.5)
    } else {
        (1.0, 0.0)
    };

    winner.rating = new_rating(winner.rating, actual_w, exp_w, k_w);
    loser.rating = new_rating(loser.rating, actual_l, exp_l, k_l);

    winner.total_games += 1;
    loser.total_games += 1;

    if is_draw {
        winner.draws += 1;
        loser.draws += 1;
        winner.streak = 0;
        loser.streak = 0;
    } else {
        winner.wins += 1;
        loser.losses += 1;
        if winner.streak > 0 { winner.streak += 1; } else { winner.streak = 1; }
        if loser.streak < 0 { loser.streak -= 1; } else { loser.streak = -1; }
    }
}

/// Persist ELO records in SQLite.
pub struct EloDb {
    conn: Connection,
}

impl EloDb {
    pub fn open(path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS htp_elo (
                address TEXT NOT NULL,
                game TEXT NOT NULL,
                rating REAL NOT NULL DEFAULT 1200.0,
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                draws INTEGER NOT NULL DEFAULT 0,
                streak INTEGER NOT NULL DEFAULT 0,
                total_games INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (address, game)
            );
            CREATE INDEX IF NOT EXISTS idx_elo_game_rating ON htp_elo(game, rating DESC);"
        )?;
        Ok(Self { conn })
    }

    /// Upsert a record.
    pub fn upsert(&self, r: &EloRecord) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "INSERT OR REPLACE INTO htp_elo (address, game, rating, wins, losses, draws, streak, total_games, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![r.address, r.game, r.rating, r.wins, r.losses, r.draws, r.streak, r.total_games, r.updated_at],
        )?;
        Ok(())
    }

    /// Get top N players by rating for a specific game.
    pub fn get_top_n(&self, game: &str, limit: u32) -> Result<Vec<EloRecord>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT address, game, rating, wins, losses, draws, streak, total_games, updated_at
             FROM htp_elo WHERE game = ?1 ORDER BY rating DESC LIMIT ?2"
        )?;
        let rows = stmt.query_map(params![game, limit], |row| {
            Ok(EloRecord {
                address: row.get(0)?,
                game: row.get(1)?,
                rating: row.get(2)?,
                wins: row.get(3)?,
                losses: row.get(4)?,
                draws: row.get(5)?,
                streak: row.get(6)?,
                total_games: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        let mut records = Vec::new();
        for r in rows { records.push(r?); }
        Ok(records)
    }

    /// Get a player's record for a specific game.
    pub fn get_player(&self, address: &str, game: &str) -> Result<Option<EloRecord>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT address, game, rating, wins, losses, draws, streak, total_games, updated_at
             FROM htp_elo WHERE address = ?1 AND game = ?2"
        )?;
        let mut rows = stmt.query_map(params![address, game], |row| {
            Ok(EloRecord {
                address: row.get(0)?, game: row.get(1)?, rating: row.get(2)?,
                wins: row.get(3)?, losses: row.get(4)?, draws: row.get(5)?,
                streak: row.get(6)?, total_games: row.get(7)?, updated_at: row.get(8)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_elo_calculation() {
        let mut w = EloRecord {
            address: "kaspa:aaa".into(), game: "chess".into(),
            rating: 1200.0, wins: 5, losses: 3, draws: 2,
            streak: 2, total_games: 10, updated_at: "".into(),
        };
        let mut l = EloRecord {
            address: "kaspa:bbb".into(), game: "chess".into(),
            rating: 1200.0, wins: 4, losses: 4, draws: 2,
            streak: -1, total_games: 10, updated_at: "".into(),
        };
        update_ratings(&mut w, &mut l, false);
        assert!(w.rating > 1200.0, "winner rating should increase");
        assert!(l.rating < 1200.0, "loser rating should decrease");
        assert_eq!(w.wins, 6);
        assert_eq!(l.losses, 5);
        assert_eq!(w.streak, 3);
        assert_eq!(l.streak, -2);
    }

    #[test]
    fn test_draw_breaks_streak() {
        let mut w = EloRecord {
            address: "kaspa:aaa".into(), game: "chess".into(),
            rating: 1300.0, wins: 10, losses: 2, draws: 1,
            streak: 5, total_games: 13, updated_at: "".into(),
        };
        let mut l = EloRecord {
            address: "kaspa:bbb".into(), game: "chess".into(),
            rating: 1250.0, wins: 8, losses: 3, draws: 1,
            streak: -2, total_games: 12, updated_at: "".into(),
        };
        update_ratings(&mut w, &mut l, true);
        assert_eq!(w.streak, 0);
        assert_eq!(l.streak, 0);
    }

    #[test]
    fn test_sqlite_persistence() {
        let db = EloDb::open(":memory:").unwrap();
        let r = EloRecord {
            address: "kaspa:test".into(), game: "chess".into(),
            rating: 1250.0, wins: 3, losses: 1, draws: 0,
            streak: 2, total_games: 4, updated_at: "2026-05-05".into(),
        };
        db.upsert(&r).unwrap();
        let got = db.get_player("kaspa:test", "chess").unwrap().unwrap();
        assert_eq!(got.rating, 1250.0);
        assert_eq!(got.wins, 3);

        let top = db.get_top_n("chess", 5).unwrap();
        assert!(top.len() >= 1);
    }
}
