// htp-zk-pipeline.js v1.0
// ZK proof pipeline stub — forwards oracle resolution proofs to Rust backend
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZKPipeline = {
    submit: function(proof, marketId, outcome) {
      return fetch(API + '/oracle/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, marketId: marketId, outcome: outcome })
      })
      .then(function(r){
        if (!r.ok) throw new Error('[HTP ZK Pipeline] submit failed: ' + r.status);
        return r.json();
      });
    },
    verify: function(proofId) {
      return fetch(API + '/oracle/zk/verify/' + proofId)
        .then(function(r){
          if (!r.ok) throw new Error('[HTP ZK Pipeline] verify failed: ' + r.status);
          return r.json();
        });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
