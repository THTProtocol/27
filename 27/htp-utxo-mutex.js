// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising concurrent UTXO operations
(function(){
  'use strict';
  var _queue = Promise.resolve();
  var _locked = false;
  window.HTPUtxoMutex = {
    acquire: function() {
      var resolve;
      var ticket = new Promise(function(r){ resolve = r; });
      _queue = _queue.then(function() {
        _locked = true;
        return ticket;
      });
      return {
        release: function() {
          _locked = false;
          resolve();
        }
      };
    },
    isLocked: function() { return _locked; },
    wrap: function(fn) {
      return function() {
        var args = arguments;
        var ctx = this;
        var lock = window.HTPUtxoMutex.acquire();
        return Promise.resolve().then(function() {
          return fn.apply(ctx, args);
        }).finally(function() {
          lock.release();
        });
      };
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
