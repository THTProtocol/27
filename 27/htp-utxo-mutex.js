/* HTP UTXO Mutex v1.0 — prevents double-spend on concurrent TX */
(function(){
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(utxoId) {
      if (_locks[utxoId]) return false;
      _locks[utxoId] = Date.now();
      return true;
    },
    release: function(utxoId) { delete _locks[utxoId]; },
    isLocked: function(utxoId) { return !!_locks[utxoId]; }
  };
  console.log('[HTP UTXO Mutex] loaded');
})();
