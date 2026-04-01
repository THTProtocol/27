(async function() {
  const MAX_WAIT = 45000;
  const CHECK_INTERVAL = 500;
  let elapsed = 0;

  async function tryLoadWasm() {
    if (typeof kaspaWasm !== 'undefined' && kaspaWasm.default) {
      try {
        await kaspaWasm.default('/kaspa_bg.wasm');
        window.kaspaSDK = kaspaWasm;
        console.log('[HTP WASM] Loaded successfully');
        window.dispatchEvent(new Event('htpWasmReady'));
        return true;
      } catch(e) {
        console.warn('[HTP WASM] Init error:', e);
        return false;
      }
    }
    return false;
  }

  while (elapsed < MAX_WAIT) {
    if (await tryLoadWasm()) return;
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
    elapsed += CHECK_INTERVAL;
  }
  console.error('[HTP WASM] Failed to load after 45s — running in legacy mode');
  window.dispatchEvent(new Event('htpWasmFailed'));
})();
