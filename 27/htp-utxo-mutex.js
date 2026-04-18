/* htp-utxo-mutex.js — UTXO spend-lock / mutex
 * Prevents double-spend races when two payout paths fire concurrently.
 */
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');

  var _locks = {};

  window.HTPUtxoMutex = {
    /**
     * Acquire a lock for a given matchId + utxo key.
     * Returns true if lock was granted, false if already held.
     */
    acquire: function(key) {
      if (_locks[key]) return false;
      _locks[key] = Date.now();
      return true;
    },

    /** Release the lock. */
    release: function(key) {
      delete _locks[key];
    },

    /** Check without acquiring. */
    isLocked: function(key) {
      return !!_locks[key];
    },

    /** Auto-expire locks older than 60 s (safety net). */
    gc: function() {
      var now = Date.now();
      Object.keys(_locks).forEach(function(k) {
        if (now - _locks[k] > 60000) delete _locks[k];
      });
    }
  };

  // Run GC every 30 s
  setInterval(function(){ window.HTPUtxoMutex.gc(); }, 30000);
})();
