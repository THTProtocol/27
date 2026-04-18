/* htp-zk-pipeline.js — HTP ZK Pipeline stub v1.0
   Proof submission + verification shim; delegates to Rust backend. */
(function(){
  'use strict';
  console.log('[HTP ZK Pipeline] loaded');

  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    submitProof: function(marketId, outcome, proof) {
      return fetch(API + '/oracle/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, outcome: outcome, proof: proof })
      }).then(function(r) { return r.json(); });
    },
    verifyProof: function(marketId, proofId) {
      return fetch(API + '/oracle/zk/verify/' + marketId + '/' + proofId)
        .then(function(r) { return r.json(); });
    }
  };
})();
