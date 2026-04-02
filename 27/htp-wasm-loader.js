(async function() {
  var wasmUrl = window.location.origin + '/kaspa_bg.wasm';
  var MAX_ATTEMPTS = 3;
  var TIMEOUT = 30000;

  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      var backoff = Math.pow(2, attempt - 1) * 1000;
      if (attempt > 1) await new Promise(function(r) { setTimeout(r, backoff); });

      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, TIMEOUT);

      // Try loading via __wbg_init if available
      if (typeof __wbg_init === 'function') {
        await __wbg_init(wasmUrl);
        clearTimeout(timer);
        window.kaspaSDK = window.wasm_bindgen || window.kaspaWasm;
        window.wasmReady = true;
        console.log('[HTP Init] WASM ready');
        window.dispatchEvent(new Event('htpWasmReady'));
        return;
      }

      // Fallback: try kaspaWasm.default
      if (typeof kaspaWasm !== 'undefined' && kaspaWasm.default) {
        await kaspaWasm.default(wasmUrl);
        clearTimeout(timer);
        window.kaspaSDK = kaspaWasm;
        window.wasmReady = true;
        console.log('[HTP Init] WASM ready');
        window.dispatchEvent(new Event('htpWasmReady'));
        return;
      }

      clearTimeout(timer);
      throw new Error('No WASM init function available');
    } catch (e) {
      console.warn('[HTP WASM] Attempt ' + attempt + '/' + MAX_ATTEMPTS + ' failed:', e.message);
    }
  }

  // All attempts failed - show banner
  console.error('[HTP WASM] Failed after 3 attempts');
  window.wasmReady = false;
  window.dispatchEvent(new Event('htpWasmFailed'));

  var banner = document.createElement('div');
  banner.id = 'wasm-fail-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px;background:#ef4444;color:white;text-align:center;z-index:9999;font-family:Inter,sans-serif;font-size:14px;';
  banner.textContent = 'Kaspa SDK unavailable. Some features require the browser extension wallet.';
  document.body.prepend(banner);
})();
