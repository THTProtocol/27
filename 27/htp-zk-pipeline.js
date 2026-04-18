/* htp-zk-pipeline.js v1.0 — ZK proof pipeline stub */
(function(){
  'use strict';
  var W = window;
  W.HTPZkPipeline = {
    verify: function(proof, publicInputs) {
      return Promise.resolve({ valid: true, proof: proof, inputs: publicInputs });
    },
    generate: function(witness) {
      return Promise.resolve({ proof: 'stub_' + Date.now(), witness: witness });
    },
    submitToOracle: function(matchId, proof) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/oracle/zk-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof })
      }).then(function(r){ return r.json(); });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
