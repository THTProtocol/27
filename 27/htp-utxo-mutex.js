// htp-utxo-mutex.js v1.0
// Prevents double-spend by locking UTXOs during TX construction
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
    tryLock: function(matchId, timeoutMs) {
      var self = this;
      timeoutMs = timeoutMs || 30000;
      if (this.lock(matchId)) return Promise.resolve(true);
      return new Promise(function(resolve) {
        var start = Date.now();
        var interval = setInterval(function() {
          if (!self.isLocked(matchId)) {
            clearInterval(interval);
            self.lock(matchId);
            resolve(true);
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
