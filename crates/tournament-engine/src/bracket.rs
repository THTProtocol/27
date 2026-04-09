//! Bracket management — single-elimination, double-elimination, round-robin.

use serde::{Deserialize, Serialize};

/// 33-byte compressed secp256k1 public key (Kaspa P2PK identity).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct PlayerId(pub [u8; 33]);

impl Serialize for PlayerId {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_hex())
    }
}

impl<'de> Deserialize<'de> for PlayerId {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        PlayerId::from_hex(&s).map_err(serde::de::Error::custom)
    }
}

impl PlayerId {
    pub fn from_hex(hex_str: &str) -> Result<Self, String> {
        let bytes = hex_decode(hex_str)?;
        if bytes.len() != 33 {
            return Err(format!("expected 33 bytes, got {}", bytes.len()));
        }
        let mut arr = [0u8; 33];
        arr.copy_from_slice(&bytes);
        Ok(PlayerId(arr))
    }

    pub fn to_hex(&self) -> String {
        self.0.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("odd-length hex".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum TournamentFormat {
    SingleElimination,
    DoubleElimination,
    RoundRobin,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum MatchResult {
    Pending,
    Winner(PlayerId),
    Draw,
}

/// A single match within a bracket round.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Match {
    pub player_a: PlayerId,
    pub player_b: PlayerId,
    pub result: MatchResult,
    pub escrow_utxo: Option<String>,
    pub game_type: String,
    pub game_state_json: Option<String>,
}

/// One round of the bracket.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TournamentBracket {
    pub round: u32,
    pub matches: Vec<Match>,
}

/// Full tournament state.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Tournament {
    pub id: String,
    pub name: String,
    pub format: TournamentFormat,
    pub game_type: String,
    pub players: Vec<PlayerId>,
    pub brackets: Vec<TournamentBracket>,
    pub current_round: u32,
    pub spectator_pool_utxo: Option<String>,
    pub is_finished: bool,
    pub champion: Option<PlayerId>,
}

impl Tournament {
    /// Create a new single-elimination tournament.
    /// Player count must be a power of 2 (2, 4, 8, 16, ...).
    pub fn new_single_elimination(
        id: String,
        name: String,
        game_type: String,
        players: Vec<PlayerId>,
    ) -> Result<Self, String> {
        let n = players.len();
        if n < 2 || (n & (n - 1)) != 0 {
            return Err(format!("Player count must be a power of 2, got {}", n));
        }

        let matches: Vec<Match> = players
            .chunks(2)
            .map(|pair| Match {
                player_a: pair[0],
                player_b: pair[1],
                result: MatchResult::Pending,
                escrow_utxo: None,
                game_type: game_type.clone(),
                game_state_json: None,
            })
            .collect();

        Ok(Tournament {
            id,
            name,
            format: TournamentFormat::SingleElimination,
            game_type,
            players,
            brackets: vec![TournamentBracket { round: 0, matches }],
            current_round: 0,
            spectator_pool_utxo: None,
            is_finished: false,
            champion: None,
        })
    }

    /// Create a round-robin tournament (everyone plays everyone).
    pub fn new_round_robin(
        id: String,
        name: String,
        game_type: String,
        players: Vec<PlayerId>,
    ) -> Result<Self, String> {
        if players.len() < 2 {
            return Err("Need at least 2 players".into());
        }

        // Generate all pairings as "round 0"
        let mut matches = vec![];
        for i in 0..players.len() {
            for j in (i + 1)..players.len() {
                matches.push(Match {
                    player_a: players[i],
                    player_b: players[j],
                    result: MatchResult::Pending,
                    escrow_utxo: None,
                    game_type: game_type.clone(),
                    game_state_json: None,
                });
            }
        }

        Ok(Tournament {
            id,
            name,
            format: TournamentFormat::RoundRobin,
            game_type,
            players,
            brackets: vec![TournamentBracket { round: 0, matches }],
            current_round: 0,
            spectator_pool_utxo: None,
            is_finished: false,
            champion: None,
        })
    }

    /// Record the result of a match in the current round.
    pub fn set_match_result(
        &mut self,
        match_index: usize,
        result: MatchResult,
    ) -> Result<(), String> {
        if self.is_finished {
            return Err("Tournament is already finished".into());
        }

        let bracket = self
            .brackets
            .get_mut(self.current_round as usize)
            .ok_or("Invalid round")?;

        let m = bracket
            .matches
            .get_mut(match_index)
            .ok_or_else(|| format!("Invalid match index {}", match_index))?;

        if !matches!(m.result, MatchResult::Pending) {
            return Err("Match already decided".into());
        }

        // Validate winner is a participant
        if let MatchResult::Winner(winner) = result {
            if winner != m.player_a && winner != m.player_b {
                return Err("Winner must be one of the match participants".into());
            }
        }

        m.result = result;
        Ok(())
    }

    /// Store the game state JSON for a match (for oracle verification).
    pub fn set_match_game_state(
        &mut self,
        match_index: usize,
        json: String,
    ) -> Result<(), String> {
        let bracket = self
            .brackets
            .get_mut(self.current_round as usize)
            .ok_or("Invalid round")?;
        let m = bracket
            .matches
            .get_mut(match_index)
            .ok_or_else(|| format!("Invalid match index {}", match_index))?;
        m.game_state_json = Some(json);
        Ok(())
    }

    /// Check if all matches in the current round have been decided.
    pub fn is_round_complete(&self) -> bool {
        self.brackets
            .get(self.current_round as usize)
            .map(|b| b.matches.iter().all(|m| !matches!(m.result, MatchResult::Pending)))
            .unwrap_or(false)
    }

    /// Advance to the next round (single-elimination: create new matchups from winners).
    pub fn advance_round(&mut self) -> Result<(), String> {
        if !self.is_round_complete() {
            return Err("Current round is not complete".into());
        }

        match self.format {
            TournamentFormat::SingleElimination => self.advance_single_elimination(),
            TournamentFormat::RoundRobin => self.finish_round_robin(),
            TournamentFormat::DoubleElimination => {
                Err("Double elimination advance not yet implemented".into())
            }
        }
    }

    fn advance_single_elimination(&mut self) -> Result<(), String> {
        let winners: Vec<PlayerId> = self.brackets[self.current_round as usize]
            .matches
            .iter()
            .filter_map(|m| match m.result {
                MatchResult::Winner(w) => Some(w),
                _ => None,
            })
            .collect();

        if winners.is_empty() {
            return Err("No winners found in current round".into());
        }

        if winners.len() == 1 {
            self.champion = Some(winners[0]);
            self.is_finished = true;
            return Ok(());
        }

        if winners.len() % 2 != 0 {
            return Err("Odd number of winners — cannot pair for next round".into());
        }

        let next_matches: Vec<Match> = winners
            .chunks(2)
            .map(|pair| Match {
                player_a: pair[0],
                player_b: pair[1],
                result: MatchResult::Pending,
                escrow_utxo: None,
                game_type: self.game_type.clone(),
                game_state_json: None,
            })
            .collect();

        self.current_round += 1;
        self.brackets.push(TournamentBracket {
            round: self.current_round,
            matches: next_matches,
        });

        Ok(())
    }

    fn finish_round_robin(&mut self) -> Result<(), String> {
        // Tally wins per player
        let mut wins: std::collections::HashMap<PlayerId, u32> = std::collections::HashMap::new();
        for m in &self.brackets[0].matches {
            if let MatchResult::Winner(w) = m.result {
                *wins.entry(w).or_insert(0) += 1;
            }
        }

        // Champion = most wins
        if let Some((&champ, _)) = wins.iter().max_by_key(|(_, &v)| v) {
            self.champion = Some(champ);
        }
        self.is_finished = true;
        Ok(())
    }

    /// Total number of rounds (single-elimination only).
    pub fn total_rounds(&self) -> u32 {
        match self.format {
            TournamentFormat::SingleElimination => {
                (self.players.len() as f64).log2() as u32
            }
            _ => self.brackets.len() as u32,
        }
    }

    /// Get the champion if tournament is finished.
    pub fn champion(&self) -> Option<PlayerId> {
        self.champion
    }

    /// Serialize full tournament to JSON.
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }

    /// Deserialize tournament from JSON.
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_player(id: u8) -> PlayerId {
        let mut arr = [0u8; 33];
        arr[0] = 0x02;
        arr[32] = id;
        PlayerId(arr)
    }

    #[test]
    fn test_single_elimination_creation() {
        let players = vec![mock_player(1), mock_player(2), mock_player(3), mock_player(4)];
        let t = Tournament::new_single_elimination("t1".into(), "Test".into(), "chess".into(), players).unwrap();
        assert!(!t.is_finished);
        assert_eq!(t.brackets[0].matches.len(), 2);
        assert_eq!(t.total_rounds(), 2);
    }

    #[test]
    fn test_reject_non_power_of_2() {
        let players = vec![mock_player(1), mock_player(2), mock_player(3)];
        assert!(Tournament::new_single_elimination("t".into(), "T".into(), "chess".into(), players).is_err());
    }

    #[test]
    fn test_full_tournament_flow() {
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        let p3 = mock_player(3);
        let p4 = mock_player(4);
        let mut t = Tournament::new_single_elimination(
            "t1".into(), "Test".into(), "chess".into(), vec![p1, p2, p3, p4],
        ).unwrap();

        // Round 0
        t.set_match_result(0, MatchResult::Winner(p1)).unwrap();
        t.set_match_result(1, MatchResult::Winner(p4)).unwrap();
        assert!(t.is_round_complete());
        t.advance_round().unwrap();
        assert!(!t.is_finished);

        // Round 1 (final)
        assert_eq!(t.brackets[1].matches.len(), 1);
        t.set_match_result(0, MatchResult::Winner(p4)).unwrap();
        t.advance_round().unwrap();
        assert!(t.is_finished);
        assert_eq!(t.champion(), Some(p4));
    }

    #[test]
    fn test_round_robin() {
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        let p3 = mock_player(3);
        let mut t = Tournament::new_round_robin(
            "rr1".into(), "Round Robin".into(), "connect4".into(), vec![p1, p2, p3],
        ).unwrap();

        // 3 players → 3 matches
        assert_eq!(t.brackets[0].matches.len(), 3);
        t.set_match_result(0, MatchResult::Winner(p1)).unwrap(); // p1 vs p2
        t.set_match_result(1, MatchResult::Winner(p1)).unwrap(); // p1 vs p3
        t.set_match_result(2, MatchResult::Winner(p3)).unwrap(); // p2 vs p3
        t.advance_round().unwrap();
        assert!(t.is_finished);
        assert_eq!(t.champion(), Some(p1)); // p1 has 2 wins
    }

    #[test]
    fn test_reject_invalid_winner() {
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        let p3 = mock_player(3);
        let p4 = mock_player(4);
        let mut t = Tournament::new_single_elimination(
            "t".into(), "T".into(), "chess".into(), vec![p1, p2, p3, p4],
        ).unwrap();
        // p3 is not in match 0 (p1 vs p2)
        assert!(t.set_match_result(0, MatchResult::Winner(p3)).is_err());
    }

    #[test]
    fn test_serialization_roundtrip() {
        let players = vec![mock_player(1), mock_player(2), mock_player(3), mock_player(4)];
        let t = Tournament::new_single_elimination("t1".into(), "Test".into(), "chess".into(), players).unwrap();
        let json = t.to_json();
        let t2 = Tournament::from_json(&json).unwrap();
        assert_eq!(t2.id, t.id);
        assert_eq!(t2.brackets[0].matches.len(), 2);
    }
}
