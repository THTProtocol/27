/* htp-utxo-mutex.js — HTP UTXO Mutex stub v1.0 */
(function() {
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      if (_locks[matchId]) return false;
      _locks[matchId] = Date.now();
      return true;
    },
    release: function(matchId) {
      delete _locks[matchId];
    },
    isLocked: function(matchId) {
      return !!_locks[matchId];
    }
  };
})();
