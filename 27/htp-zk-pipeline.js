// htp-zk-pipeline.js v1.0
// ZK proof pipeline stub — submits proof requests to Rust backend
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    submit: function(opts) {
      // opts: { matchId, outcome, witness, network }
      return fetch(API + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK submit failed: ' + r.status);
        return r.json();
      });
    },
    verify: function(proofId) {
      return fetch(API + '/zk/verify/' + proofId)
        .then(function(r) {
          if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
          return r.json();
        });
    },
    status: function(proofId) {
      return fetch(API + '/zk/status/' + proofId)
        .then(function(r) { return r.json(); })
        .catch(function() { return { status: 'unknown' }; });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
