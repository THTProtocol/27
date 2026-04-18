/* htp-utxo-mutex.js — UTXO spend-lock stub */
(function(){
  'use strict';
  var W = typeof window !== 'undefined' ? window : this;
  W.HTPUtxoMutex = {
    _locks: {},
    acquire: function(utxoId) {
      if (this._locks[utxoId]) return false;
      this._locks[utxoId] = true;
      return true;
    },
    release: function(utxoId) {
      delete this._locks[utxoId];
    },
    isLocked: function(utxoId) {
      return !!this._locks[utxoId];
    }
  };
  console.log('[HTP UTXO Mutex] loaded');
})();
