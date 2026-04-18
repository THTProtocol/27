// htp-utxo-mutex.js v1.0
// Prevents concurrent UTXO spends (double-spend guard)
(function(){
  'use strict';
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      if (_locks[matchId]) {
        return Promise.reject(new Error('[HTPUtxoMutex] Lock already held for ' + matchId));
      }
      _locks[matchId] = true;
      return Promise.resolve();
    },
    release: function(matchId) {
      delete _locks[matchId];
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    },
    withLock: function(matchId, fn) {
      var self = this;
      return self.acquire(matchId).then(function() {
        return Promise.resolve().then(fn).then(function(result) {
          self.release(matchId);
          return result;
        }).catch(function(err) {
          self.release(matchId);
          throw err;
        });
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
