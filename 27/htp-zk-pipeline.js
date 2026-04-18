// htp-zk-pipeline.js v1.0
// ZK proof pipeline shim — submits oracle attestations to Rust backend for verification
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
  window.HTPZkPipeline = {
    verify: function(proof, publicInputs) {
      return fetch(API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, inputs: publicInputs })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      });
    },
    attest: function(marketId, outcome, bondAmount) {
      return fetch(API + '/zk/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, outcome: outcome, bond: bondAmount })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK attest failed: ' + r.status);
        return r.json();
      });
    },
    submit: function(marketId, proofBundle) {
      return fetch(API + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, bundle: proofBundle })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK submit failed: ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
