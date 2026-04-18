/* htp-zk-pipeline.js — HTP ZK Pipeline stub v1.0
 * Stub for ZK proof generation/verification pipeline.
 * Full ZK logic is handled server-side via Rust backend.
 * Prevents 404/500 on script load.
 */
(function(){
  'use strict';
  console.log('[HTP ZK Pipeline] loaded');

  window.HTPZkPipeline = window.HTPZkPipeline || {
    // Submit a proof request to the Rust backend.
    submitProof: function(matchId, moves, outcome) {
      var api = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, moves: moves, outcome: outcome })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK submit failed: ' + r.status);
        return r.json();
      });
    },
    // Verify a proof via the Rust backend.
    verifyProof: function(matchId, proofId) {
      var api = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/verify/' + matchId + '/' + proofId)
        .then(function(r) {
          if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
          return r.json();
        });
    }
  };
})();
