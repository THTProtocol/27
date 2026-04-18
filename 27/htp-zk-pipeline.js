// htp-zk-pipeline.js v1.0
// ZK proof verification pipeline stub — delegates to Rust API
(function(){
  'use strict';
  var API = function() { return window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app'; };
  window.HTPZkPipeline = {
    // Submit a game move hash for ZK proof generation
    submitMoveHash: function(matchId, moveHash, network) {
      network = network || window.localStorage.getItem('htp_network') || 'tn12';
      return fetch(API() + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, moveHash: moveHash, network: network })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] submit failed: ' + r.status);
        return r.json();
      });
    },
    // Verify a ZK proof for settlement
    verifyProof: function(matchId, proof) {
      return fetch(API() + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTP ZK] verify failed: ' + r.status);
        return r.json();
      });
    },
    // Check if ZK pipeline is online
    health: function() {
      return fetch(API() + '/zk/health', { method: 'GET', signal: AbortSignal.timeout(5000) })
        .then(function(r) { return r.ok; })
        .catch(function() { return false; });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
