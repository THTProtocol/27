/**
 * htp-wasm-loader.js — High Table Protocol — v5.0
 * WATCHDOG for Kaspa WASM SDK initialisation.
 * Gracefully handles missing SDK without breaking the app.
 */
(function() {
  'use strict';
  var MAX_WAIT = 60000; // 60s max
  var POLL = 500;
  var start = Date.now();

  function onWasmSuccess() {
    console.log('[WASM] Kaspa SDK loaded successfully');
    window.__htpWasmReady = true;
    document.dispatchEvent(new CustomEvent('htp-wasm-ready'));
  }

  function onWasmFail() {
    console.warn('[WASM] Kaspa SDK not available — running in lite mode');
    window.__htpWasmReady = false;
    window.__htpWasmLite = true;
    // Provide stub so wallet code doesn't crash
    if (!window.kaspa) {
      window.kaspa = {
        Mnemonic: { random: function(n) { return { phrase: 'stub' }; } },
        XPrv: function() {},
        Address: { isValid: function() { return false; } },
        UtxoProcessor: function() { return { start: function(){} }; },
        RpcClient: function() { return {
          connect: function() { return Promise.reject('lite mode'); },
          disconnect: function() {},
          addEventListener: function() {}
        }; }
      };
    }
    document.dispatchEvent(new CustomEvent('htp-wasm-ready'));
  }

  var poll = setInterval(function() {
    if (window.kaspa && typeof window.kaspa.RpcClient === 'function') {
      clearInterval(poll);
      onWasmSuccess();
    } else if (Date.now() - start > MAX_WAIT) {
      clearInterval(poll);
      onWasmFail();
    }
  }, POLL);
})();
