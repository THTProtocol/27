// htp-zk-pipeline.js v1.0
// ZK proof pipeline shim — routes to Rust backend for verification
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    verify: function(proof) {
      return fetch(API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proof)
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] Verify failed: ' + r.status);
        return r.json();
      });
    },
    submit: function(proof) {
      return fetch(API + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proof)
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] Submit failed: ' + r.status);
        return r.json();
      });
    },
    status: function(proofId) {
      return fetch(API + '/zk/status/' + proofId)
        .then(function(r) { return r.json(); });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
