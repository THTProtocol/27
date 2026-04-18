// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising UTXO consumption
(function(){
  'use strict';
  var _queue = Promise.resolve();
  var _locked = false;

  window.HTPUtxoMutex = {
    acquire: function() {
      var release;
      var ticket = new Promise(function(resolve) { release = resolve; });
      var prev = _queue;
      _queue = prev.then(function() { return ticket; });
      return prev.then(function() {
        _locked = true;
        return release;
      });
    },
    isLocked: function() { return _locked; },
    wrap: function(fn) {
      return window.HTPUtxoMutex.acquire().then(function(release) {
        return Promise.resolve().then(fn).finally(function() {
          _locked = false;
          release();
        });
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
