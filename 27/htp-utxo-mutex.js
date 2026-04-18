// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising UTXO consumption
(function(){
  'use strict';
  var _queue = Promise.resolve();
  var _locked = false;

  window.HTPUtxoMutex = {
    acquire: function() {
      var resolve;
      var next = new Promise(function(res) { resolve = res; });
      var release = _queue.then(function() {
        _locked = true;
        return function() {
          _locked = false;
          resolve();
        };
      });
      _queue = next;
      return release;
    },
    isLocked: function() { return _locked; },
    wrap: function(fn) {
      return function() {
        var args = arguments;
        var self = this;
        return window.HTPUtxoMutex.acquire().then(function(release) {
          var result;
          try {
            result = fn.apply(self, args);
          } finally {
            if (!(result && typeof result.then === 'function')) {
              release();
              return result;
            }
          }
          return result.then(
            function(v) { release(); return v; },
            function(e) { release(); throw e; }
          );
        });
      };
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
