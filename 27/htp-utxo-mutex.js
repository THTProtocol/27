/* htp-utxo-mutex.js — UTXO mutex stub */
window.HTPUtxoMutex = { lock: function(id,fn){ return fn(); }, release: function(){} };
console.log('[HTP UTXO Mutex] loaded');
