/**
 * htp-wasm-loader.js  —  High Table Protocol  —  v3.1
 *
 * Initialises the Kaspa WASM SDK binary (kaspa_bg.wasm) using the JS glue
 * code loaded from kaspa-wasm-sdk-inline.js (which defines __wbg_init / initSync).
 *
 * After successful init, exports all SDK classes to window.kaspaSDK and calls
 * window._onWasmReady() (the boot gate in htp-init.js).
 *
 * LOAD ORDER: kaspa-wasm-sdk-inline.js → htp-init.js → THIS → htp-rpc-client.js
 */
(async function() {
  'use strict';
  var MAX_ATTEMPTS = 3;
  var BASE_TIMEOUT = 15000; // 15s, doubles each retry
  var SDK_EXPORTS = [
    'PrivateKey','PublicKey','Transaction','TransactionInput','TransactionOutput',
    'ScriptPublicKey','UtxoEntryReference','UtxoEntry','UtxoProcessor','UtxoContext',
    'createTransactions','signTransaction',
    'Address','addressFromScriptPublicKey','Mnemonic','XPrv','XPub','DerivationPath',
    'kaspaToSompi','sompiToKaspaString','NetworkType','NetworkId',
    'RpcClient','Resolver'
  ];

  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      var timeout = BASE_TIMEOUT * Math.pow(2, attempt - 1);
      var wasmUrl = window.location.origin + '/kaspa_bg.wasm';
      console.log('[HTP WASM] Attempt ' + attempt + '/' + MAX_ATTEMPTS + ' (timeout: ' + (timeout/1000) + 's)');

      var loaded = await Promise.race([
        (async function() {
          // Primary path: __wbg_init defined by kaspa-wasm-sdk-inline.js
          if (typeof __wbg_init === 'function') {
            await __wbg_init({ module_or_path: wasmUrl });
            return true;
          }
          // Fallback: initSync with fetched bytes
          if (typeof initSync === 'function') {
            var resp = await fetch(wasmUrl);
            var bytes = await resp.arrayBuffer();
            initSync({ module: bytes });
            return true;
          }
          return false;
        })(),
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Timeout after ' + (timeout/1000) + 's')); }, timeout);
        })
      ]);

      if (loaded) {
        // Export all SDK classes to window.kaspaSDK
        window.kaspaSDK = window.kaspaSDK || {};
        SDK_EXPORTS.forEach(function(name) {
          if (typeof window[name] !== 'undefined') {
            window.kaspaSDK[name] = window[name];
          }
        });

        window.wasmReady = true;
        console.log('[HTP WASM] SDK loaded — ' + Object.keys(window.kaspaSDK).length + ' exports registered');
        console.log('[HTP WASM] Resolver available:', !!window.kaspaSDK.Resolver);
        console.log('[HTP WASM] RpcClient available:', !!window.kaspaSDK.RpcClient);

        // Fire the boot gate in htp-init.js
        if (typeof window._onWasmReady === 'function') {
          window._onWasmReady();
        }
        window.dispatchEvent(new Event('htpWasmReady'));

        // Enable any .wasm-gate elements
        document.querySelectorAll('.wasm-gate').forEach(function(el) {
          el.disabled = false;
          el.style.opacity = '1';
          el.title = '';
        });

        return; // Success — exit
      }
    } catch(e) {
      console.warn('[HTP WASM] Attempt ' + attempt + ' failed:', e.message);
    }
  }

  // All attempts failed
  console.error('[HTP WASM] Failed after ' + MAX_ATTEMPTS + ' attempts — SDK JS present:',
    typeof __wbg_init === 'function', '| initSync:', typeof initSync === 'function');
  window.wasmReady = false;
  window.dispatchEvent(new Event('htpWasmFailed'));

  // Show banner
  var banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#1d2840;border:1px solid rgba(239,68,68,0.3);color:#e2e8f0;padding:12px 24px;border-radius:8px;z-index:999;font-family:Inter,sans-serif;font-size:14px;max-width:500px;text-align:center;';
  banner.textContent = 'Kaspa SDK unavailable. Some features require the browser extension wallet.';
  document.body.appendChild(banner);
  setTimeout(function() { banner.style.opacity = '0'; banner.style.transition = 'opacity 0.5s'; setTimeout(function() { banner.remove(); }, 500); }, 15000);
})();
