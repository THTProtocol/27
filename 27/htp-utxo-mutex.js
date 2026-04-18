// htp-utxo-mutex.js v1.0
// Prevents concurrent UTXO consumption (double-spend guard)
(function(){
  'use strict';
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      return new Promise(function(resolve, reject) {
        if (_locks[matchId]) {
          return reject(new Error('[HTP UTXO Mutex] Lock already held for: ' + matchId));
        }
        _locks[matchId] = true;
        console.log('[HTP UTXO Mutex] Lock acquired:', matchId);
        resolve(function release() {
          delete _locks[matchId];
          console.log('[HTP UTXO Mutex] Lock released:', matchId);
        });
      });
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    },
    forceRelease: function(matchId) {
      delete _locks[matchId];
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
