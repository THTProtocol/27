// Tournament Engine for HTP
// Wraps multiple skill-game Episodes and manages bracket progression.
// Spectator betting reuses ParimutuelMarket covenant — each tournament
// has an escrow for per-match parimutuel pools + a global tournament-winner pool.

use std::collections::HashMap;

/// 33-byte compressed secp256k1 public key (Kaspa P2PK identity).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct PublicKey(pub [u8; 33]);

impl PublicKey {
    pub fn from_hex(hex_str: &str) -> Result<Self, String> {
        let bytes = hex_decode(hex_str).map_err(|e| format!("bad hex: {}", e))?;
        if bytes.len() != 33 { return Err(format!("expected 33 bytes, got {}", bytes.len())); }
        let mut arr = [0u8; 33];
        arr.copy_from_slice(&bytes);
        Ok(PublicKey(arr))
    }
    pub fn to_hex(&self) -> String { hex_encode(&self.0) }
}

/// Simple hex helpers (no external crate dependency for a single file).
fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 { return Err("odd-length hex".into()); }
    (0..s.len()).step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i+2], 16).map_err(|e| e.to_string()))
        .collect()
}

/// A single match within a bracket round.
#[derive(Clone, Debug)]
pub struct Match {
    pub player_a: PublicKey,
    pub player_b: PublicKey,
    pub winner: Option<PublicKey>,
    pub escrow_utxo: Option<String>,  // Per-match parimutuel escrow txid
    pub game_type: String,            // "chess", "connect4", "checkers"
}

#[derive(Clone, Debug)]
pub struct TournamentBracket {
    pub round: u32,
    pub matches: Vec<Match>,
}

#[derive(Clone, Debug)]
pub struct Tournament {
    pub id: String,
    pub name: String,
    pub format: String,  // "single-elimination", "double-elimination", "round-robin"
    pub game_type: String,
    pub players: Vec<PublicKey>,
    pub brackets: Vec<TournamentBracket>,
    pub current_round: u32,
    pub spectator_pool_utxo: Option<String>,  // Global tournament-winner pool escrow
    pub is_finished: bool,
    pub champion: Option<PublicKey>,
}

impl Tournament {
    /// Create a new single-elimination tournament from a list of players.
    /// Generates round-1 matchups automatically. Player count must be a power of 2.
    pub fn new(id: String, name: String, game_type: String, players: Vec<PublicKey>) -> Result<Self, String> {
        let n = players.len();
        if n < 2 || (n & (n - 1)) != 0 {
            return Err(format!("Player count must be a power of 2, got {}", n));
        }

        // Build first round
        let matches: Vec<Match> = players.chunks(2).map(|pair| {
            Match {
                player_a: pair[0],
                player_b: pair[1],
                winner: None,
                escrow_utxo: None,
                game_type: game_type.clone(),
            }
        }).collect();

        let bracket = TournamentBracket { round: 0, matches };

        Ok(Tournament {
            id,
            name,
            format: "single-elimination".to_string(),
            game_type,
            players,
            brackets: vec![bracket],
            current_round: 0,
            spectator_pool_utxo: None,
            is_finished: false,
            champion: None,
        })
    }

    /// Record the winner of a match in the current round.
    pub fn advance_winner(&mut self, match_index: usize, winner: PublicKey) -> Result<(), String> {
        if self.is_finished {
            return Err("Tournament is already finished".to_string());
        }

        let bracket = self.brackets.get_mut(self.current_round as usize)
            .ok_or_else(|| "Invalid round".to_string())?;

        let m = bracket.matches.get_mut(match_index)
            .ok_or_else(|| format!("Invalid match index {}", match_index))?;

        if winner != m.player_a && winner != m.player_b {
            return Err("Winner must be one of the match participants".to_string());
        }
        if m.winner.is_some() {
            return Err("Match already decided".to_string());
        }

        m.winner = Some(winner);
        Ok(())
    }

    /// Check if all matches in the current round have a winner.
    pub fn is_round_complete(&self) -> bool {
        self.brackets.get(self.current_round as usize)
            .map(|b| b.matches.iter().all(|m| m.winner.is_some()))
            .unwrap_or(false)
    }

    /// Advance to the next round. Creates new matchups from current round winners.
    /// If only one winner remains, the tournament is finished.
    pub fn advance_round(&mut self) -> Result<(), String> {
        if !self.is_round_complete() {
            return Err("Current round is not complete".to_string());
        }

        let winners: Vec<PublicKey> = self.brackets[self.current_round as usize]
            .matches.iter()
            .filter_map(|m| m.winner)
            .collect();

        if winners.len() == 1 {
            self.champion = Some(winners[0]);
            self.is_finished = true;
            return Ok(());
        }

        let next_matches: Vec<Match> = winners.chunks(2).map(|pair| {
            Match {
                player_a: pair[0],
                player_b: pair[1],
                winner: None,
                escrow_utxo: None,
                game_type: self.game_type.clone(),
            }
        }).collect();

        self.current_round += 1;
        self.brackets.push(TournamentBracket {
            round: self.current_round,
            matches: next_matches,
        });

        Ok(())
    }

    /// Total number of rounds needed (log2 of player count).
    pub fn total_rounds(&self) -> u32 {
        (self.players.len() as f64).log2() as u32
    }

    /// Get the champion if tournament is finished.
    pub fn get_champion(&self) -> Option<PublicKey> {
        self.champion
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_key(id: u8) -> PublicKey {
        let mut arr = [0u8; 33];
        arr[0] = 0x02; // compressed key prefix
        arr[32] = id;
        PublicKey(arr)
    }

    #[test]
    fn test_tournament_creation() {
        let players = vec![mock_key(1), mock_key(2), mock_key(3), mock_key(4)];
        let t = Tournament::new("t1".into(), "Test".into(), "chess".into(), players).unwrap();
        assert!(!t.is_finished);
        assert_eq!(t.brackets[0].matches.len(), 2);
        assert_eq!(t.total_rounds(), 2);
    }

    #[test]
    fn test_reject_non_power_of_2() {
        let players = vec![mock_key(1), mock_key(2), mock_key(3)];
        assert!(Tournament::new("t".into(), "T".into(), "chess".into(), players).is_err());
    }

    #[test]
    fn test_full_tournament_flow() {
        let p1 = mock_key(1); let p2 = mock_key(2);
        let p3 = mock_key(3); let p4 = mock_key(4);
        let mut t = Tournament::new("t1".into(), "Test".into(), "chess".into(), vec![p1, p2, p3, p4]).unwrap();

        // Round 0
        t.advance_winner(0, p1).unwrap();
        t.advance_winner(1, p4).unwrap();
        assert!(t.is_round_complete());
        t.advance_round().unwrap();
        assert!(!t.is_finished);

        // Round 1 (final)
        assert_eq!(t.brackets[1].matches.len(), 1);
        t.advance_winner(0, p4).unwrap();
        assert!(t.is_round_complete());
        t.advance_round().unwrap();
        assert!(t.is_finished);
        assert_eq!(t.get_champion(), Some(p4));
    }

    #[test]
    fn test_reject_invalid_winner() {
        let p1 = mock_key(1); let p2 = mock_key(2);
        let p3 = mock_key(3); let p4 = mock_key(4);
        let mut t = Tournament::new("t".into(), "T".into(), "chess".into(), vec![p1, p2, p3, p4]).unwrap();
        // Try to set p3 as winner of match 0 (p1 vs p2) — should fail
        assert!(t.advance_winner(0, p3).is_err());
    }

    #[test]
    fn test_reject_double_advance() {
        let p1 = mock_key(1); let p2 = mock_key(2);
        let p3 = mock_key(3); let p4 = mock_key(4);
        let mut t = Tournament::new("t".into(), "T".into(), "chess".into(), vec![p1, p2, p3, p4]).unwrap();
        t.advance_winner(0, p1).unwrap();
        assert!(t.advance_winner(0, p2).is_err()); // already decided
    }
}
