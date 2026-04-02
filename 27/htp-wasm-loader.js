(async function() {
  'use strict';
  var MAX_ATTEMPTS = 3;
  var BASE_TIMEOUT = 10000; // 10s, doubles each retry

  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      var timeout = BASE_TIMEOUT * Math.pow(2, attempt - 1);
      var wasmUrl = window.location.origin + '/kaspa_bg.wasm';
      console.log('[HTP WASM] Attempt ' + attempt + '/' + MAX_ATTEMPTS + ' (timeout: ' + (timeout/1000) + 's)');

      var loaded = await Promise.race([
        (async function() {
          if (typeof __wbg_init === 'function') {
            await __wbg_init(wasmUrl);
            return true;
          }
          return false;
        })(),
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Timeout')); }, timeout);
        })
      ]);

      if (loaded) {
        window.wasmReady = true;
        console.log('[HTP Init] WASM ready');
        window.dispatchEvent(new Event('htpWasmReady'));
        return;
      }
    } catch(e) {
      console.warn('[HTP WASM] Attempt ' + attempt + ' failed:', e.message);
    }
  }

  // All attempts failed
  console.error('[HTP WASM] Failed after ' + MAX_ATTEMPTS + ' attempts');
  window.wasmReady = false;
  window.dispatchEvent(new Event('htpWasmFailed'));

  // Show banner
  var banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#1d2840;border:1px solid rgba(239,68,68,0.3);color:#e2e8f0;padding:12px 24px;border-radius:8px;z-index:999;font-family:Inter,sans-serif;font-size:14px;max-width:500px;text-align:center;';
  banner.textContent = 'Kaspa SDK unavailable. Some features require the browser extension wallet.';
  document.body.appendChild(banner);
  setTimeout(function() { banner.style.opacity = '0'; banner.style.transition = 'opacity 0.5s'; setTimeout(function() { banner.remove(); }, 500); }, 15000);
})();
