/* HTP UTXO Mutex v1.0 — prevents double-spend on concurrent TX builds */
(function(){
  var _locks = {};
  window.HTPUtxoMutex = {
    acquire: function(addr) { if(_locks[addr]) return false; _locks[addr]=true; return true; },
    release: function(addr) { delete _locks[addr]; }
  };
  console.log('[HTP UTXO Mutex] loaded');
})();
