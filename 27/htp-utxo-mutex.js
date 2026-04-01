/**
 * htp-utxo-mutex.js — HTP UTXO Concurrency Guard v1.0
 * 
 * Wraps window.htpSendTx with a serial queue so concurrent match payouts
 * cannot double-spend the same UTXO. All callers await the queue in order.
 * 
 * LOAD ORDER: must be injected BEFORE htp-covenant-escrow-v2.js in index.html
 *   <script src="htp-utxo-mutex.js"></script>
 *   <script src="htp-covenant-escrow-v2.js"></script>
 */

(function () {
  'use strict';

  // Queue state
  let _queue = Promise.resolve();
  let _pending = 0;

  /**
   * Wraps an async fn so all calls run serially (FIFO).
   */
  function serialise(fn) {
    return function (...args) {
      _pending++;
      const result = _queue.then(() => fn.apply(this, args));
      // Advance queue; swallow errors so queue never breaks on TX failure
      _queue = result.catch(() => {}).finally(() => { _pending--; });
      return result;
    };
  }

  /**
   * Attempt to wrap htpSendTx immediately, or poll until it appears.
   * htpSendTx is set by wasm-bridge.js which loads async.
   */
  function installMutex() {
    if (typeof window.htpSendTx === 'function' && !window.htpSendTx._mutexWrapped) {
      const original = window.htpSendTx;
      window.htpSendTx = serialise(original);
      window.htpSendTx._mutexWrapped = true;
      window.htpSendTx._original = original;
      console.log('[HTP-MUTEX] htpSendTx serialised — UTXO double-spend guard active');
      return true;
    }
    return false;
  }

  // Try immediately, then poll every 300ms for up to 30s
  if (!installMutex()) {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (installMutex() || attempts > 100) clearInterval(poll);
    }, 300);
  }

  // Expose queue depth for debugging
  Object.defineProperty(window, 'htpMutexPending', {
    get: () => _pending,
    configurable: true
  });

  console.log('[HTP-MUTEX] UTXO mutex loaded — waiting for htpSendTx');
})();
