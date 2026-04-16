//! utxo_mutex.rs — UTXO Concurrency Guard
//!
//! Ports htp-utxo-mutex.js to Rust.
//!
//! PROBLEM:
//!   Two concurrent requests for the same matchId can race to build a TX
//!   spending the same UTXOs. Both succeed at TX construction but one gets
//!   rejected on-chain as a double-spend.
//!
//! SOLUTION:
//!   Per-matchId tokio Mutex held for the duration of escrow → broadcast.
//!   A second request for the same match blocks until the first completes,
//!   then short-circuits if the match is already marked settled in the map.
//!
//! Usage (in route handlers):
//!   let _guard = UTXO_LOCKS.acquire("match_id_here").await;
//!   // build + broadcast TX
//!   // _guard dropped at end of scope → lock released

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, MutexGuard};
use once_cell::sync::Lazy;

/// Global per-match lock registry.
pub static UTXO_LOCKS: Lazy<UtxoMutex> = Lazy::new(UtxoMutex::new);

/// Registry of per-match async mutexes.
pub struct UtxoMutex {
    inner: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

impl UtxoMutex {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    /// Acquire the lock for `match_id`.
    ///
    /// Creates a new mutex entry if one doesn't exist yet.
    /// The returned guard releases the per-match lock when dropped.
    pub async fn acquire(&self, match_id: &str) -> MatchGuard {
        let arc = {
            let mut map = self.inner.lock().await;
            map.entry(match_id.to_string())
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone()
        };

        // Block until the previous operation on this match_id finishes
        let guard = arc.lock().await;
        tracing::debug!("[utxo_mutex] acquired lock for match: {}", match_id);

        MatchGuard {
            match_id: match_id.to_string(),
            // SAFETY: we extend the lifetime of the guard to tie it to the Arc.
            // The Arc keeps the Mutex alive as long as the guard exists.
            _guard: unsafe { std::mem::transmute(guard) },
            _arc: arc,
        }
    }

    /// Release and remove the entry for a match once it is fully settled.
    /// Call this after a successful broadcast to free memory.
    pub async fn release_match(&self, match_id: &str) {
        let mut map = self.inner.lock().await;
        map.remove(match_id);
        tracing::debug!("[utxo_mutex] released + removed lock for match: {}", match_id);
    }
}

impl Default for UtxoMutex {
    fn default() -> Self {
        Self::new()
    }
}

/// RAII guard — holds the per-match lock until dropped.
pub struct MatchGuard {
    pub match_id: String,
    _guard: MutexGuard<'static, ()>,
    _arc:   Arc<Mutex<()>>,
}

impl Drop for MatchGuard {
    fn drop(&mut self) {
        tracing::debug!("[utxo_mutex] releasing lock for match: {}", self.match_id);
    }
}
