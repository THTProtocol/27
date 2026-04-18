/* htp-utxo-mutex.js */
(function(){'use strict';var L={};window.HTPUtxoMutex={acquire:function(id){L[id]=Date.now();return true;},release:function(id){delete L[id];},isLocked:function(id){return!!L[id];}};console.log('[HTP UTXO Mutex] loaded');})();
