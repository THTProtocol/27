(async function() {
  'use strict';
  var wasmUrl = window.location.origin + '/kaspa_bg.wasm';
  var MAX_ATTEMPTS = 3;
  var TIMEOUT = 30000;

  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      var backoff = Math.pow(2, attempt - 1) * 1000;
      if (attempt > 1) {
        console.log('[HTP WASM] Retry ' + attempt + '/' + MAX_ATTEMPTS + ' in ' + backoff + 'ms');
        await new Promise(function(r) { setTimeout(r, backoff); });
      }

      // Try loading via __wbg_init if available (from inline glue code)
      if (typeof __wbg_init === 'function') {
        await Promise.race([
          __wbg_init(wasmUrl),
          new Promise(function(_, rej) { setTimeout(function() { rej(new Error('WASM init timeout')); }, TIMEOUT); })
        ]);
        window.wasmReady = true;
        console.log('[HTP Init] WASM ready (attempt ' + attempt + ')');
        // Bridge to htp-init.js gate system
        if (typeof window._onWasmReady === 'function') window._onWasmReady();
        // Unlock any wasm-gate elements directly as fallback
        document.querySelectorAll('.wasm-gate').forEach(function(el) {
          el.disabled = false; el.style.opacity = '1'; el.title = '';
        });
        window.dispatchEvent(new Event('htpWasmReady'));
        return;
      }

      // Fallback: try kaspaWasm.default
      if (typeof kaspaWasm !== 'undefined' && kaspaWasm.default) {
        await Promise.race([
          kaspaWasm.default(wasmUrl),
          new Promise(function(_, rej) { setTimeout(function() { rej(new Error('WASM init timeout')); }, TIMEOUT); })
        ]);
        window.kaspaSDK = kaspaWasm;
        window.wasmReady = true;
        console.log('[HTP Init] WASM ready via kaspaWasm (attempt ' + attempt + ')');
        if (typeof window._onWasmReady === 'function') window._onWasmReady();
        document.querySelectorAll('.wasm-gate').forEach(function(el) {
          el.disabled = false; el.style.opacity = '1'; el.title = '';
        });
        window.dispatchEvent(new Event('htpWasmReady'));
        return;
      }

      throw new Error('No WASM init function available');
    } catch (e) {
      console.warn('[HTP WASM] Attempt ' + attempt + '/' + MAX_ATTEMPTS + ' failed:', e.message);
    }
  }

  // All attempts failed
  console.error('[HTP WASM] Failed after ' + MAX_ATTEMPTS + ' attempts');
  window.wasmReady = false;
  window._wasmFailed = true;
  window.dispatchEvent(new Event('htpWasmFailed'));

  // Show the banner from index.html if it exists
  var banner = document.getElementById('wasmBanner');
  if (banner) { banner.classList.add('show'); }
})();
