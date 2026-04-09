// Tournament Engine for HTP
// Wraps multiple skill-game Episodes and manages bracket progression
// Spectator betting reuses ParimutuelMarket covenant

use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct TournamentBracket {
    pub round: u32,
    pub matches: Vec<Option<PublicKey>>,  // winner of each match in this round
}

#[derive(Clone, Debug)]
pub struct Tournament {
    pub id: String,
    pub name: String,
    pub format: String,  // "single-elimination", "double-elimination", "round-robin"
    pub players: Vec<PublicKey>,
    pub bracket: Vec<TournamentBracket>,
    pub current_round: u32,
    pub spectator_pool_utxo: Option<String>,  // Reference to pool UTXO
    pub is_finished: bool,
    pub champion: Option<PublicKey>,
}

impl Tournament {
    pub fn new(id: String, name: String, format: String, players: Vec<PublicKey>) -> Self {
        Tournament {
            id,
            name,
            format,
            players,
            bracket: vec![],
            current_round: 0,
            spectator_pool_utxo: None,
            is_finished: false,
            champion: None,
        }
    }

    pub fn advance_winner(&mut self, match_index: usize, winner: PublicKey) -> Result<(), String> {
        if self.is_finished {
            return Err("Tournament is already finished".to_string());
        }

        // Update bracket
        if let Some(bracket) = self.bracket.get_mut(self.current_round as usize) {
            if match_index < bracket.matches.len() {
                bracket.matches[match_index] = Some(winner);
                return Ok(());
            }
        }

        Err("Invalid match index".to_string())
    }

    pub fn check_round_complete(&mut self) -> bool {
        if let Some(bracket) = self.bracket.get(self.current_round as usize) {
            bracket.matches.iter().all(|m| m.is_some())
        } else {
            false
        }
    }

    pub fn advance_round(&mut self) {
        self.current_round += 1;
        if self.current_round >= self.bracket.len() as u32 {
            // Determine champion
            if let Some(last_bracket) = self.bracket.last() {
                if let Some(Some(champion)) = last_bracket.matches.first() {
                    self.champion = Some(*champion);
                    self.is_finished = true;
                }
            }
        }
    }

    pub fn get_winner(&self) -> Option<PublicKey> {
        self.champion
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tournament_creation() {
        let players = vec![];  // Mock players
        let tournament = Tournament::new(
            "t1".to_string(),
            "Test Tournament".to_string(),
            "single-elimination".to_string(),
            players,
        );
        assert_eq!(tournament.is_finished, false);
    }
}
