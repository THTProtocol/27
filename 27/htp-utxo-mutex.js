/* htp-utxo-mutex.js — stub v1.0 */
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex] stub loaded');
  window.HTPUtxoMutex = window.HTPUtxoMutex || {
    _locks: {},
    acquire: function(key) {
      if (this._locks[key]) return Promise.reject(new Error('UTXO locked: ' + key));
      this._locks[key] = true;
      return Promise.resolve();
    },
    release: function(key) {
      delete this._locks[key];
    },
    version: '1.0-stub'
  };
})();
