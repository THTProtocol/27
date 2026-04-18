/* htp-utxo-mutex.js — HTP UTXO Mutex v1.0 */
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex v1.0] loaded');

  var W = window;
  var _locks = {};

  /**
   * Acquire a lock for a given key (matchId or escrow address).
   * Returns true if acquired, false if already locked.
   */
  function acquire(key) {
    if (_locks[key]) return false;
    _locks[key] = Date.now();
    return true;
  }

  /**
   * Release a lock.
   */
  function release(key) {
    delete _locks[key];
  }

  /**
   * Check if locked.
   */
  function isLocked(key) {
    return !!_locks[key];
  }

  /**
   * Auto-expire locks older than ttlMs (default 60s) to prevent deadlocks.
   */
  function gcLocks(ttlMs) {
    ttlMs = ttlMs || 60000;
    var now = Date.now();
    Object.keys(_locks).forEach(function(k) {
      if (now - _locks[k] > ttlMs) delete _locks[k];
    });
  }

  setInterval(function() { gcLocks(60000); }, 30000);

  W.HTPUtxoMutex = { acquire: acquire, release: release, isLocked: isLocked };
})();
