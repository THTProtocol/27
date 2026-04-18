/* htp-zk-pipeline.js v1.0 — ZK proof pipeline stub (oracle verification) */
(function(){
  'use strict';
  var W = window;
  W.HTPZkPipeline = {
    /**
     * Verify a ZK proof for oracle resolution.
     * In production this calls the Rust backend /zk/verify endpoint.
     * Returns a Promise<{valid: bool, reason: string}>.
     */
    verify: function(proof, publicInputs) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, publicInputs: publicInputs })
      })
      .then(function(r) { return r.json(); })
      .catch(function(e) {
        console.warn('[HTPZkPipeline] verify error:', e.message);
        return { valid: false, reason: e.message };
      });
    },
    /**
     * Generate a ZK proof for a game result.
     * Returns a Promise<{proof: string, publicInputs: object}>.
     */
    generate: function(gameId, moves, result) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameId, moves: moves, result: result })
      })
      .then(function(r) { return r.json(); })
      .catch(function(e) {
        console.warn('[HTPZkPipeline] generate error:', e.message);
        return null;
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
