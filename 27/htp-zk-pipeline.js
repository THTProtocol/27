// htp-zk-pipeline.js v1.0
// ZK proof pipeline stub — verifies oracle attestations via Rust backend
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    verify: function(marketId, outcome, proof) {
      return fetch(API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, outcome: outcome, proof: proof })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] verify failed: ' + r.status);
        return r.json();
      }).then(function(d) {
        console.log('[HTP ZK Pipeline] Verified:', marketId, d);
        return d;
      });
    },
    submit: function(marketId, outcome, attestation) {
      return fetch(API + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, outcome: outcome, attestation: attestation })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] submit failed: ' + r.status);
        return r.json();
      }).then(function(d) {
        console.log('[HTP ZK Pipeline] Submitted:', marketId, d);
        return d;
      });
    },
    // Fallback: bond-attested resolution (no ZK proof required)
    bondAttest: function(marketId, outcome, bondAddress) {
      return fetch(API + '/oracle/bond-attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: marketId, outcome: outcome, bondAddress: bondAddress })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] bond-attest failed: ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
