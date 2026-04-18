/* htp-utxo-mutex.js — HTP UTXO Mutex stub v1.0
   Prevents double-spend races by serialising payout attempts per matchId. */
(function(){
  'use strict';
  console.log('[HTP UTXO Mutex] loaded');

  var _locks = {};

  window.HTPUtxoMutex = {
    acquire: function(matchId) {
      if (_locks[matchId]) return false;
      _locks[matchId] = true;
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
