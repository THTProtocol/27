//! DAA-score deadline watcher.
//!
//! Polls the Kaspa REST API for the current virtual DAA score.
//! When a match deadline is reached, triggers settlement.
//!
//! DAA score ~= 10 ticks/sec on mainnet.
//! 1 second ≈ 10 DAA ticks.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{debug, info};

/// A registered deadline.
#[derive(Clone)]
pub struct Deadline {
    pub match_id:    String,
    pub target_daa:  u64,
    pub label:       String,
    pub fired:       bool,
}

/// Registry of active deadlines.
#[derive(Default, Clone)]
pub struct DeadlineRegistry {
    deadlines: Arc<Mutex<HashMap<String, Deadline>>>,
}

impl DeadlineRegistry {
    pub fn register(&self, match_id: &str, target_daa: u64, label: &str) {
        let mut map = self.deadlines.lock().unwrap();
        map.insert(match_id.to_string(), Deadline {
            match_id:   match_id.to_string(),
            target_daa,
            label:      label.to_string(),
            fired:      false,
        });
        info!("Deadline registered: {} ({}) → DAA {}", match_id, label, target_daa);
    }

    /// Check all deadlines against current DAA score.
    /// Returns list of match IDs whose deadlines have just fired.
    pub fn check(&self, current_daa: u64) -> Vec<String> {
        let mut map  = self.deadlines.lock().unwrap();
        let mut fired = Vec::new();
        for d in map.values_mut() {
            if !d.fired && current_daa >= d.target_daa {
                d.fired = true;
                fired.push(d.match_id.clone());
                info!("Deadline fired: {} ({}) at DAA {}", d.match_id, d.label, current_daa);
            }
        }
        fired
    }

    pub fn remove(&self, match_id: &str) {
        self.deadlines.lock().unwrap().remove(match_id);
    }

    pub fn active_count(&self) -> usize {
        self.deadlines.lock().unwrap().values().filter(|d| !d.fired).count()
    }
}

/// Convert seconds to DAA ticks.
pub fn seconds_to_daa(seconds: u64) -> u64 { seconds * 10 }

/// Convert DAA ticks to approximate seconds.
pub fn daa_to_seconds(daa: u64) -> f64 { daa as f64 / 10.0 }
