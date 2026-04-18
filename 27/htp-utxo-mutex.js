/* htp-utxo-mutex.js — HTP UTXO Mutex stub v1.0
   Prevents double-spend by serialising concurrent TX builds.
*/
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');

  var W = window;
  var _queue = Promise.resolve();

  W.HTPUtxoMutex = {
    /**
     * Acquire the mutex, run fn(), then release.
     * Returns fn()'s resolved value.
     */
    run: function(fn) {
      _queue = _queue.then(function() {
        return Promise.resolve().then(fn);
      });
      return _queue;
    },
    /** Reset the queue (emergency use only) */
    reset: function() {
      _queue = Promise.resolve();
    }
  };
})();
