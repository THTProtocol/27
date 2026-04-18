// htp-zk-pipeline.js v1.0
// ZK proof verification pipeline for oracle resolutions
(function(){
  'use strict';
  window.HTPZkPipeline = {
    RUST_API: window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app',
    verify: function(proof, publicInputs) {
      var self = this;
      return fetch(self.RUST_API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, public_inputs: publicInputs })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      })
      .then(function(data) {
        console.log('[HTP ZK Pipeline] Proof verified:', data);
        return data;
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] Verify error (non-fatal):', e.message);
        return { verified: false, error: e.message };
      });
    },
    generateProof: function(witness) {
      var self = this;
      return fetch(self.RUST_API + '/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ witness: witness })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('ZK prove failed: ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] Prove error (non-fatal):', e.message);
        return null;
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
