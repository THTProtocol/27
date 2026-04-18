// htp-zk-pipeline.js v1.0
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
  window.HTPZkPipeline = {
    verify: function(proof, publicInputs) {
      return fetch(API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, publicInputs: publicInputs })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] verify failed: ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] verify error:', e.message);
        return { verified: false, error: e.message };
      });
    },
    generateProof: function(gameLog, outcome) {
      return fetch(API + '/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameLog: gameLog, outcome: outcome })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] prove failed: ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] prove error:', e.message);
        return { proof: null, error: e.message };
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
