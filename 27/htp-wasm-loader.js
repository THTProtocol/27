/**
 * htp-wasm-loader.js - WASM Init with Exponential Backoff
 * 
 * Loads kaspa_bg.wasm with 3 attempts, 30s timeout each,
 * exponential backoff between retries.
 */
(async function () {
  'use strict';

  var wasmUrl = window.location.origin + '/kaspa_bg.wasm';
  var MAX_ATTEMPTS = 3;
  var TIMEOUT_MS = 30000;

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function attemptInit() {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('WASM init timed out after ' + TIMEOUT_MS + 'ms'));
      }, TIMEOUT_MS);

      (async function () {
        try {
          if (typeof __wbg_init === 'function') {
            await __wbg_init(wasmUrl);
            clearTimeout(timer);
            window.kaspaSDK = window.wasm_bindgen || window.kaspaWasm;
            resolve(true);
            return;
          }
          if (typeof kaspaWasm !== 'undefined' && kaspaWasm.default) {
            await kaspaWasm.default(wasmUrl);
            clearTimeout(timer);
            window.kaspaSDK = kaspaWasm;
            resolve(true);
            return;
          }
          clearTimeout(timer);
          reject(new Error('No WASM init function found'));
        } catch (e) {
          clearTimeout(timer);
          reject(e);
        }
      })();
    });
  }

  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        var backoff = Math.pow(2, attempt - 1) * 1000;
        console.log('[HTP WASM] Retry ' + attempt + '/' + MAX_ATTEMPTS + ' in ' + backoff + 'ms');
        await delay(backoff);
      }
      await attemptInit();
      window.wasmReady = true;
      console.log('%c[HTP Init] WASM ready', 'color:#4f98a3;font-weight:bold');
      window.dispatchEvent(new Event('htpWasmReady'));
      return;
    } catch (e) {
      console.warn('[HTP WASM] Attempt ' + attempt + '/' + MAX_ATTEMPTS + ' failed:', e.message);
    }
  }

  /* All attempts failed */
  console.error('[HTP WASM] Failed after ' + MAX_ATTEMPTS + ' attempts');
  window.wasmReady = false;
  window.dispatchEvent(new Event('htpWasmFailed'));

  var banner = document.createElement('div');
  banner.id = 'wasm-fail-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'padding:12px 24px', 'background:#ef4444', 'color:#fff',
    'text-align:center', 'z-index:9999',
    'font-family:Inter,sans-serif', 'font-size:14px', 'font-weight:500'
  ].join(';');
  banner.textContent = 'Kaspa SDK unavailable. Some features require the browser extension wallet.';
  if (document.body) {
    document.body.prepend(banner);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.prepend(banner);
    });
  }
})();
