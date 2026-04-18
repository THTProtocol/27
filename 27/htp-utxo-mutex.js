// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising concurrent TX builds
(function(){
  'use strict';
  var _locked = false;
  var _queue = [];
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
    wrap: function(fn) {
      return function() {
        var args = arguments;
        var self = this;
        return window.HTPUtxoMutex.acquire().then(function() {
          return Promise.resolve(fn.apply(self, args)).finally(function() {
            window.HTPUtxoMutex.release();
          });
        });
      };
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded — concurrent TX serialisation active');
})();
