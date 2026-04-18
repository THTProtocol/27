<<<<<<< HEAD
/* htp-utxo-mutex.js v1.0 — UTXO spend lock to prevent double-spend */
(function(){
  'use strict';
  var W = window;
  var _locks = {};
  W.HTPUtxoMutex = {
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
    releaseStale: function(maxAgeMs) {
      var now = Date.now();
      Object.keys(_locks).forEach(function(k) {
        if (now - _locks[k] > (maxAgeMs || 60000)) delete _locks[k];
      });
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
=======
/* HTP UTXO Mutex v1.0 — prevents double-spend on concurrent TX builds */
(function(W){
  'use strict';
  var _locked = {};
  W.HTPUtxoMutex = {
    acquire: function(escrowAddr) {
      if (_locked[escrowAddr]) return false;
      _locked[escrowAddr] = Date.now();
      return true;
    },
    release: function(escrowAddr) {
      delete _locked[escrowAddr];
    },
    isLocked: function(escrowAddr) {
      return !!_locked[escrowAddr];
    },
    autoRelease: function(escrowAddr, ms) {
      setTimeout(function(){ delete _locked[escrowAddr]; }, ms || 30000);
    }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})(window);
>>>>>>> d3fb362 (fix: add 4 missing JS modules, silence /deadline/daa 500 errors)
