// htp-zk-pipeline.js v1.0
// ZK proof pipeline stub — wraps Rust backend ZK endpoints
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    // Verify a ZK proof for oracle resolution
    verifyProof: function(opts) {
      // opts: { marketId, outcome, proof, publicInputs }
      return fetch(API + '/oracle/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      });
    },
    // Submit a ZK proof for on-chain settlement
    submitProof: function(opts) {
      // opts: { marketId, outcome, proof, publicInputs, txHex }
      return fetch(API + '/oracle/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK submit failed: ' + r.status);
        return r.json();
      });
    },
    // Generate a proof hash for attestation
    hashAttestation: function(data) {
      var str = JSON.stringify(data);
      var h = 0;
      for (var i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
      }
      return 'zk0x' + Math.abs(h).toString(16).padStart(8, '0');
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded — ZK oracle pipeline ready');
})();
