// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising concurrent TX builds
(function(){
  'use strict';
  var _queue = Promise.resolve();
  var _locked = false;

  window.HTPUtxoMutex = {
    acquire: function() {
      var release;
      _queue = _queue.then(function() {
        return new Promise(function(resolve) { release = resolve; });
      });
      _locked = true;
      return release;
    },
    isLocked: function() { return _locked; },
    wrap: function(fn) {
      return function() {
        var args = arguments;
        var release = window.HTPUtxoMutex.acquire();
        return Promise.resolve()
          .then(function() { return fn.apply(this, args); })
          .finally(function() { _locked = false; if (release) release(); });
      };
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
