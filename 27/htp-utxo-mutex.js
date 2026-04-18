// htp-utxo-mutex.js v1.0
// Prevents double-spend by serialising UTXO selection across concurrent payout calls
(function(){
  'use strict';
  var _queue = Promise.resolve();
  var _locked = false;

  window.HTPUtxoMutex = {
    acquire: function() {
      var release;
      var p = new Promise(function(res){ release = res; });
      var ticket = _queue.then(function(){ _locked = true; return release; });
      _queue = _queue.then(function(){ return p; });
      return ticket;
    },
    isLocked: function(){ return _locked; }
  };
  console.log('[HTP UTXO Mutex v1.0] loaded');
})();
