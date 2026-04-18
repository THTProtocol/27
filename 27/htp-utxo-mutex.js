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
    expireStale: function(maxAgeMs) {
      var now = Date.now();
      Object.keys(_locks).forEach(function(id) {
        if (now - _locks[id] > (maxAgeMs || 60000)) delete _locks[id];
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
