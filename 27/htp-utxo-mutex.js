/* htp-utxo-mutex.js — HTP UTXO Mutex v1.0
 * Prevents double-spend by serialising concurrent UTXO operations.
 */
(function(){
  'use strict';
  var W = window;

  var _queue   = [];
  var _locked  = false;
  var _lockId  = null;

  function next() {
    if (_locked || _queue.length === 0) return;
    var item = _queue.shift();
    _locked = true;
    _lockId = item.id;
    item.run().then(function(result){
      _locked = false;
      _lockId = null;
      if (typeof item.resolve === 'function') item.resolve(result);
      next();
    }).catch(function(err){
      _locked = false;
      _lockId = null;
      if (typeof item.reject === 'function') item.reject(err);
      next();
    });
  }

  W.HTPUtxoMutex = {
    /**
     * Enqueue an async UTXO operation.
     * @param {string} id       - human-readable lock identifier
     * @param {Function} fn     - async function that returns a Promise
     * @returns {Promise}
     */
    enqueue: function(id, fn) {
      return new Promise(function(resolve, reject){
        _queue.push({ id: id, run: fn, resolve: resolve, reject: reject });
        next();
      });
    },

    isLocked: function() { return _locked; },
    currentLock: function() { return _lockId; },
    queueDepth: function() { return _queue.length; }
  };

  console.log('[HTP UTXO Mutex v1.0] loaded — UTXO serialisation active');
})();
