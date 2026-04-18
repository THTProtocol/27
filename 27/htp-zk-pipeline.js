/* htp-zk-pipeline.js — HTP ZK Pipeline stub v1.0 */
(function() {
  'use strict';
  console.log('[HTP ZK Pipeline] loaded');
  window.HTPZKPipeline = {
    buildProof: function(moves, outcome) {
      return Promise.resolve({
        proof: btoa(JSON.stringify({ moves: moves, outcome: outcome, ts: Date.now() })),
        valid: true
      });
    },
    verifyProof: function(proofB64) {
      try {
        var data = JSON.parse(atob(proofB64));
        return Promise.resolve({ valid: !!(data.moves && data.outcome) });
      } catch(e) {
        return Promise.resolve({ valid: false });
      }
    },
    submitToOracle: function(matchId, proof) {
      var api = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/oracle/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof })
      }).then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); });
    }
  };
})();
