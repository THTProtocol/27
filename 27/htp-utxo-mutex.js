/* htp-utxo-mutex.js — HTP UTXO Mutex v1.0 */
(function(){
  'use strict';
  var W = window;
  var _locks = {};

  W.HTPUtxoMutex = {
    acquire: function(matchId) {
      if (_locks[matchId]) {
        console.warn('[HTP UTXO Mutex] Lock already held for', matchId);
        return false;
      }
      _locks[matchId] = Date.now();
      console.log('[HTP UTXO Mutex] Acquired lock for', matchId);
      return true;
    },

    release: function(matchId) {
      if (_locks[matchId]) {
        delete _locks[matchId];
        console.log('[HTP UTXO Mutex] Released lock for', matchId);
      }
    },

    isLocked: function(matchId) {
      return !!_locks[matchId];
    },

    withLock: function(matchId, fn) {
      if (!this.acquire(matchId)) return Promise.reject(new Error('UTXO lock held: ' + matchId));
      var self = this;
      return Promise.resolve().then(fn).finally(function() { self.release(matchId); });
    }
  };

  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
