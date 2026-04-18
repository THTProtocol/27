// htp-utxo-mutex.js v1.0
(function(){
  'use strict';
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      if (_locks[matchId]) return false;
      _locks[matchId] = Date.now();
      return true;
    },
    release: function(matchId) {
      delete _locks[matchId];
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    },
    withLock: function(matchId, fn) {
      if (!this.acquire(matchId)) {
        console.warn('[HTP UTXO Mutex] Already locked:', matchId);
        return Promise.reject(new Error('UTXO mutex locked for ' + matchId));
      }
      var self = this;
      return Promise.resolve().then(fn).finally(function() {
        self.release(matchId);
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
