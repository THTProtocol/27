// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising UTXO consumption
(function(){
  'use strict';
  var _lock = false;
  var _queue = [];
  window.HTPUtxoMutex = {
    acquire: function() {
      return new Promise(function(resolve) {
        if (!_lock) {
          _lock = true;
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
        _lock = false;
      }
    },
    run: function(fn) {
      var self = this;
      return self.acquire().then(function() {
        return Promise.resolve().then(fn).finally(function() {
          self.release();
        });
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
