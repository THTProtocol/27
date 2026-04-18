// htp-utxo-mutex.js v1.0
(function(){
  'use strict';
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      if (_locks[matchId]) {
        console.warn('[HTP UTXO Mutex] Lock already held for', matchId);
        return false;
      }
      _locks[matchId] = Date.now();
      console.log('[HTP UTXO Mutex] Lock acquired:', matchId);
      return true;
    },
    release: function(matchId) {
      delete _locks[matchId];
      console.log('[HTP UTXO Mutex] Lock released:', matchId);
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    },
    expireStale: function(maxAgeMs) {
      var now = Date.now();
      var age = maxAgeMs || 60000;
      Object.keys(_locks).forEach(function(id) {
        if (now - _locks[id] > age) {
          console.warn('[HTP UTXO Mutex] Expiring stale lock:', id);
          delete _locks[id];
        }
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
