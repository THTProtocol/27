// htp-utxo-mutex.js v1.0
// Prevents concurrent UTXO consumption (double-spend guard)
(function(){
  'use strict';
  var _locks = {};
  window.HTPUtxoMutex = {
    lock: function(matchId) {
      if (_locks[matchId]) return false;
      _locks[matchId] = Date.now();
      return true;
    },
    unlock: function(matchId) {
      delete _locks[matchId];
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    },
    withLock: function(matchId, fn) {
      if (!this.lock(matchId)) {
        console.warn('[HTP UTXO Mutex] Already locked:', matchId);
        return Promise.reject(new Error('UTXO locked: ' + matchId));
      }
      var self = this;
      return Promise.resolve()
        .then(fn)
        .finally(function() { self.unlock(matchId); });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
