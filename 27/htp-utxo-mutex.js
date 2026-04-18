/* htp-utxo-mutex.js — UTXO spend-lock mutex stub */
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');

  var _locks = {};

  window.HTPUtxoMutex = {
    acquire: function(utxoId) {
      if (_locks[utxoId]) return false;
      _locks[utxoId] = Date.now();
      return true;
    },
    release: function(utxoId) {
      delete _locks[utxoId];
    },
    isLocked: function(utxoId) {
      return !!_locks[utxoId];
    },
    releaseAll: function() {
      _locks = {};
    }
  };
})();
