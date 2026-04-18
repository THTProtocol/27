/* htp-zk-pipeline.js — ZK proof pipeline shim
 * Thin client-side wrapper that delegates ZK verification requests
 * to the Rust backend (/oracle/zk-verify).  Falls back gracefully
 * if the backend is offline.
 */
(function(){
  'use strict';
  console.log('[HTP ZK Pipeline] loaded');

  var BASE = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    /**
     * Submit a ZK proof for oracle resolution.
     * @param {object} payload  { marketId, outcome, proof, publicInputs }
     * @returns {Promise<{verified: boolean, txId?: string}>}
     */
    verify: function(payload) {
      return fetch(BASE + '/oracle/zk-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
      })
      .then(function(r) {
        if (!r.ok) throw new Error('ZK verify HTTP ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] verify failed:', e.message);
        return { verified: false, error: e.message };
      });
    },

    /**
     * Fetch the current ZK circuit parameters from the backend.
     * @returns {Promise<object>}
     */
    getParams: function() {
      return fetch(BASE + '/oracle/zk-params')
        .then(function(r) { return r.json(); })
        .catch(function(e) {
          console.warn('[HTP ZK Pipeline] getParams failed:', e.message);
          return {};
        });
    }
  };
})();
