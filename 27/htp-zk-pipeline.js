/* htp-zk-pipeline.js v1.0 — ZK proof pipeline stub (oracle verification) */
(function(){
  'use strict';
  var W = window;
  W.HTPZkPipeline = {
    verify: function(proof, publicInputs) {
      /* Stub: in production this calls the Rust ZK verifier endpoint */
      return Promise.resolve({ valid: true, proof: proof, inputs: publicInputs });
    },
    submit: function(matchId, proof) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof })
      }).then(function(r) { return r.json(); });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
