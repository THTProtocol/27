/* htp-utxo-mutex.js — HTP UTXO Mutex stub v1.0
 * Prevents concurrent UTXO consumption / double-spend on payout.
 * Prevents 404/500 on script load.
 */
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');

  var _locks = {};

  window.HTPUtxoMutex = window.HTPUtxoMutex || {
    // Acquire a lock for a matchId. Returns true if acquired, false if already locked.
    acquire: function(matchId) {
      if (_locks[matchId]) {
        console.warn('[HTP UTXO Mutex] lock already held for', matchId);
        return false;
      }
      _locks[matchId] = Date.now();
      console.log('[HTP UTXO Mutex] acquired lock for', matchId);
      return true;
    },
    // Release the lock for a matchId.
    release: function(matchId) {
      delete _locks[matchId];
      console.log('[HTP UTXO Mutex] released lock for', matchId);
    },
    // Check if a matchId is currently locked.
    isLocked: function(matchId) {
      return !!_locks[matchId];
    }
  };
})();
