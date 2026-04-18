// htp-utxo-mutex.js v1.0
(function(){
  'use strict';
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      return new Promise(function(resolve, reject) {
        if (_locks[matchId]) { reject(new Error('UTXO lock busy: ' + matchId)); return; }
        _locks[matchId] = true;
        resolve(function release() { delete _locks[matchId]; });
      });
    },
    isLocked: function(matchId) { return !!_locks[matchId]; },
    release: function(matchId) { delete _locks[matchId]; }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
