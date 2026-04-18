/* htp-utxo-mutex.js — UTXO spend-lock mutex v1.0 */
(function() {
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');

  var _locks = {};

  window.HTPUtxoMutex = {
    /* Returns true if lock acquired, false if already locked */
    acquire: function(utxoKey) {
      if (_locks[utxoKey]) return false;
      _locks[utxoKey] = Date.now();
      return true;
    },
    release: function(utxoKey) {
      delete _locks[utxoKey];
    },
    isLocked: function(utxoKey) {
      return !!_locks[utxoKey];
    },
    /* Auto-release stale locks older than 120 seconds */
    gc: function() {
      var now = Date.now();
      Object.keys(_locks).forEach(function(k) {
        if (now - _locks[k] > 120000) delete _locks[k];
      });
    }
  };

  setInterval(window.HTPUtxoMutex.gc, 30000);
})();
