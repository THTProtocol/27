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
      console.log('[HTP UTXO Mutex] Acquired lock for', matchId);
      return true;
    },
    release: function(matchId) {
      if (_locks[matchId]) {
        delete _locks[matchId];
        console.log('[HTP UTXO Mutex] Released lock for', matchId);
      }
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    },
    releaseStale: function(maxAgeMs) {
      var now = Date.now();
      var age = maxAgeMs || 120000;
      Object.keys(_locks).forEach(function(id) {
        if (now - _locks[id] > age) {
          console.warn('[HTP UTXO Mutex] Releasing stale lock for', id);
          delete _locks[id];
        }
      });
    }
  };
  setInterval(function() { window.HTPUtxoMutex.releaseStale(120000); }, 60000);
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
