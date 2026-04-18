/* htp-utxo-mutex.js v1.0 — UTXO spend lock to prevent double-spend */
(function(){
  'use strict';
  var W = window;
  var _locks = {};
  W.HTPUtxoMutex = {
    acquire: function(utxoId) {
      if (_locks[utxoId]) return false;
      _locks[utxoId] = Date.now();
      return true;
    },
    release: function(utxoId) {
      delete _locks[utxoId];
    },
    isLocked: function(utxoId) {
      return !!_locks[utxoId];
    },
    releaseStale: function(maxAgeMs) {
      var now = Date.now();
      Object.keys(_locks).forEach(function(k) {
        if (now - _locks[k] > (maxAgeMs || 60000)) delete _locks[k];
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
