// htp-zk-pipeline.js v1.0
// ZK proof pipeline shim — verifies oracle attestations before settlement
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    verify: function(proof, publicInputs) {
      return fetch(API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, public_inputs: publicInputs })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] verify failed: ' + r.status);
        return r.json();
      }).then(function(data) {
        console.log('[HTP ZK Pipeline] Proof verified:', data.valid);
        return data.valid === true;
      });
    },
    generateProof: function(witness) {
      return fetch(API + '/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ witness: witness })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] prove failed: ' + r.status);
        return r.json();
      }).then(function(data) {
        console.log('[HTP ZK Pipeline] Proof generated, size:', JSON.stringify(data.proof).length);
        return data.proof;
      });
    },
    verifyOrSkip: function(proof, publicInputs) {
      if (!proof) {
        console.warn('[HTP ZK Pipeline] No proof provided — skipping ZK verification (bond fallback)');
        return Promise.resolve(true);
      }
      return this.verify(proof, publicInputs).catch(function(e) {
        console.warn('[HTP ZK Pipeline] ZK verify error, falling back to bond attestation:', e.message);
        return true;
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
