// htp-utxo-mutex.js v1.0 — UTXO mutex stub
(function() {
  'use strict';
  var _lock = false;
  window.HTPUtxoMutex = {
    acquire: function() { if (_lock) return false; _lock = true; return true; },
    release: function() { _lock = false; },
    isLocked: function() { return _lock; }
  };
  console.log('[HTP UTXO Mutex] loaded');
})();
