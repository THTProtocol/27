// htp-utxo-mutex.js v1.0
// Prevents concurrent UTXO consumption (double-spend guard)
(function(){
  'use strict';
  var _locked = false;
  var _queue  = [];

  window.HTPUtxoMutex = {
    acquire: function() {
      return new Promise(function(resolve) {
        if (!_locked) {
          _locked = true;
          resolve();
        } else {
          _queue.push(resolve);
        }
      });
    },
    release: function() {
      if (_queue.length > 0) {
        var next = _queue.shift();
        next();
      } else {
        _locked = false;
      }
    },
    isLocked: function() { return _locked; },
    // Wrap an async fn so it always acquires/releases the mutex
    wrap: function(fn) {
      return async function() {
        await window.HTPUtxoMutex.acquire();
        try {
          return await fn.apply(this, arguments);
        } finally {
          window.HTPUtxoMutex.release();
        }
      };
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
