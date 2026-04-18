// htp-zk-pipeline.js v1.0
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
  window.HTPZkPipeline = {
    // Generate ZK proof for oracle resolution
    prove: function(opts) {
      return fetch(API + '/oracle/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      }).then(function(r) {
        if (!r.ok) throw new Error('[ZK Prove] HTTP ' + r.status);
        return r.json();
      });
    },
    // Verify ZK proof on-chain
    verify: function(proof, publicInputs) {
      return fetch(API + '/oracle/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, publicInputs: publicInputs })
      }).then(function(r) {
        if (!r.ok) throw new Error('[ZK Verify] HTTP ' + r.status);
        return r.json();
      });
    },
    // Submit attested result with ZK proof
    submit: function(marketId, outcome, proof) {
      return fetch(API + '/oracle/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, outcome: outcome, proof: proof })
      }).then(function(r) {
        if (!r.ok) throw new Error('[ZK Submit] HTTP ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
