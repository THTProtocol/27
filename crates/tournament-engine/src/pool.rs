//! Spectator betting pool — tracks parimutuel wagers per match and per tournament.
//!
//! Each pool references a ParimutuelMarket covenant UTXO on the Kaspa DAG.
//! The oracle settles pools when match/tournament results are confirmed.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::bracket::PlayerId;

/// A single wager placed by a spectator.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Wager {
    pub bettor: PlayerId,
    pub amount_sompi: u64,
    pub pick: PlayerId, // who they bet on
}

/// A parimutuel pool for a single match or the overall tournament winner.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpectatorPool {
    pub pool_id: String,
    pub escrow_utxo: Option<String>,
    pub wagers: Vec<Wager>,
    pub is_settled: bool,
    pub winner: Option<PlayerId>,
}

impl SpectatorPool {
    pub fn new(pool_id: String) -> Self {
        Self {
            pool_id,
            escrow_utxo: None,
            wagers: vec![],
            is_settled: false,
            winner: None,
        }
    }

    /// Place a wager. Returns error if pool is already settled.
    pub fn place_wager(&mut self, bettor: PlayerId, pick: PlayerId, amount_sompi: u64) -> Result<(), String> {
        if self.is_settled {
            return Err("Pool is already settled".into());
        }
        if amount_sompi == 0 {
            return Err("Wager must be > 0".into());
        }
        self.wagers.push(Wager {
            bettor,
            amount_sompi,
            pick,
        });
        Ok(())
    }

    /// Total wagered across all bettors.
    pub fn total_pool(&self) -> u64 {
        self.wagers.iter().map(|w| w.amount_sompi).sum()
    }

    /// Total wagered on a specific player.
    pub fn total_on_player(&self, player: PlayerId) -> u64 {
        self.wagers
            .iter()
            .filter(|w| w.pick == player)
            .map(|w| w.amount_sompi)
            .sum()
    }

    /// Settle the pool with a winner. Returns payout map: bettor → payout_sompi.
    /// Payout is proportional to each bettor's share of the winning side.
    pub fn settle(&mut self, winner: PlayerId) -> Result<HashMap<PlayerId, u64>, String> {
        if self.is_settled {
            return Err("Already settled".into());
        }
        self.is_settled = true;
        self.winner = Some(winner);

        let total = self.total_pool();
        let winning_total = self.total_on_player(winner);

        if winning_total == 0 || total == 0 {
            // No one bet on the winner; all wagers go to the house/protocol
            return Ok(HashMap::new());
        }

        let mut payouts = HashMap::new();
        for w in &self.wagers {
            if w.pick == winner {
                // Proportional payout: (bettor_amount / winning_total) * total_pool
                let payout = (w.amount_sompi as u128 * total as u128 / winning_total as u128) as u64;
                *payouts.entry(w.bettor).or_insert(0u64) += payout;
            }
        }

        Ok(payouts)
    }

    /// Current odds for each player (total_pool / amount_on_player).
    pub fn odds(&self) -> HashMap<PlayerId, f64> {
        let total = self.total_pool() as f64;
        let mut result = HashMap::new();
        let mut seen = std::collections::HashSet::new();
        for w in &self.wagers {
            if seen.insert(w.pick) {
                let on_player = self.total_on_player(w.pick) as f64;
                if on_player > 0.0 {
                    result.insert(w.pick, total / on_player);
                }
            }
        }
        result
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
    fn test_basic_pool() {
        let mut pool = SpectatorPool::new("match-1".into());
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        let bettor_a = mock_player(10);
        let bettor_b = mock_player(11);

        pool.place_wager(bettor_a, p1, 100_000_000).unwrap(); // 1 KAS on p1
        pool.place_wager(bettor_b, p2, 300_000_000).unwrap(); // 3 KAS on p2

        assert_eq!(pool.total_pool(), 400_000_000);
        assert_eq!(pool.total_on_player(p1), 100_000_000);
        assert_eq!(pool.total_on_player(p2), 300_000_000);
    }

    #[test]
    fn test_settle_payout() {
        let mut pool = SpectatorPool::new("match-1".into());
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        let bettor_a = mock_player(10);
        let bettor_b = mock_player(11);

        pool.place_wager(bettor_a, p1, 100_000_000).unwrap();
        pool.place_wager(bettor_b, p2, 300_000_000).unwrap();

        // p1 wins — bettor_a gets the full pool (400M sompi)
        let payouts = pool.settle(p1).unwrap();
        assert_eq!(*payouts.get(&bettor_a).unwrap(), 400_000_000);
        assert!(payouts.get(&bettor_b).is_none());
    }

    #[test]
    fn test_proportional_payout() {
        let mut pool = SpectatorPool::new("match-2".into());
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        let b1 = mock_player(10);
        let b2 = mock_player(11);
        let b3 = mock_player(12);

        pool.place_wager(b1, p1, 100_000_000).unwrap();  // 1 KAS
        pool.place_wager(b2, p1, 100_000_000).unwrap();  // 1 KAS
        pool.place_wager(b3, p2, 200_000_000).unwrap();  // 2 KAS

        // p1 wins. Total pool = 4 KAS. Winning side = 2 KAS.
        // b1 gets 50% of pool = 2 KAS, b2 gets 50% = 2 KAS
        let payouts = pool.settle(p1).unwrap();
        assert_eq!(*payouts.get(&b1).unwrap(), 200_000_000);
        assert_eq!(*payouts.get(&b2).unwrap(), 200_000_000);
    }

    #[test]
    fn test_cannot_settle_twice() {
        let mut pool = SpectatorPool::new("m".into());
        let p1 = mock_player(1);
        let p2 = mock_player(2);
        pool.place_wager(mock_player(10), p1, 100).unwrap();
        pool.settle(p1).unwrap();
        assert!(pool.settle(p2).is_err());
    }

    #[test]
    fn test_cannot_wager_after_settlement() {
        let mut pool = SpectatorPool::new("m".into());
        let p1 = mock_player(1);
        pool.place_wager(mock_player(10), p1, 100).unwrap();
        pool.settle(p1).unwrap();
        assert!(pool.place_wager(mock_player(11), p1, 50).is_err());
    }
}
