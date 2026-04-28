/**
 * htp-wasm-loader.js, High Table Protocol, v5.1
 * Watchdog for Kaspa WASM SDK initialisation.
 * Gracefully handles a missing SDK without breaking the app.
 * One-shot guarded; single fail/success transition.
 */
(function() {
  'use strict';
  if (window.__htpWasmLoaderInstalled) return;
  window.__htpWasmLoaderInstalled = true;

  var MAX_WAIT = 15000; // 15s max, then lite mode
  var POLL = 300;
  var start = Date.now();
  var fired = false;

  function fire(state) {
    if (fired) return;
    fired = true;
    window.__htpWasmState = state; // 'ready' | 'lite'
    try { document.dispatchEvent(new CustomEvent('htp-wasm-ready', { detail: { state: state } })); } catch(e) {}
  }

  function onWasmSuccess() {
    console.log('[WASM] Kaspa SDK loaded successfully');
    window.__htpWasmReady = true;
    fire('ready');
  }

  function onWasmFail() {
    console.warn('[WASM] Kaspa SDK not available, running in lite mode (UI/wallet read-only).');
    window.__htpWasmReady = false;
    window.__htpWasmLite = true;
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
    fire('lite');
  }

  var poll = setInterval(function() {
    if (window.kaspaSDK && window.kaspaSDK.RpcClient) {
      clearInterval(poll);
      onWasmSuccess();
    } else if (window.kaspa && typeof window.kaspa.RpcClient === 'function' && !window.__htpWasmLite) {
      clearInterval(poll);
      onWasmSuccess();
    } else if (window.wasmLoadError || (Date.now() - start > MAX_WAIT)) {
      clearInterval(poll);
      onWasmFail();
    }
  }, POLL);
})();
