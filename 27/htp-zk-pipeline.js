// htp-zk-pipeline.js v1.0
(function(){
  'use strict';
  var RUST_API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
  window.HTPZkPipeline = {
    verify: function(proof, publicInputs) {
      return fetch(RUST_API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, public_inputs: publicInputs })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] Verify failed: ' + r.status);
        return r.json();
      })
      .then(function(d) {
        console.log('[HTP ZK Pipeline] Verification result:', d);
        return d;
      });
    },
    generate: function(witness) {
      return fetch(RUST_API + '/zk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ witness: witness })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] Generate failed: ' + r.status);
        return r.json();
      })
      .then(function(d) {
        console.log('[HTP ZK Pipeline] Proof generated:', d.proof ? 'ok' : 'empty');
        return d;
      });
    },
    attest: function(matchId, outcome, sig) {
      return fetch(RUST_API + '/zk/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, outcome: outcome, sig: sig })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] Attest failed: ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
