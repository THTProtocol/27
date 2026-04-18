// htp-zk-pipeline.js v1.0
// ZK proof pipeline shim — routes to Rust backend for proof generation/verification
(function(){
  'use strict';
  var BASE = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    // Generate a ZK proof for a move sequence
    generateProof: function(matchId, moves) {
      return fetch(BASE + '/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, moves: moves })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTPZkPipeline] prove failed: ' + r.status);
        return r.json();
      });
    },
    // Verify a ZK proof against the covenant
    verifyProof: function(matchId, proof) {
      return fetch(BASE + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTPZkPipeline] verify failed: ' + r.status);
        return r.json();
      });
    },
    // Submit verified proof to oracle for settlement
    submitToOracle: function(matchId, proof, winner) {
      return fetch(BASE + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof, winner: winner })
      }).then(function(r) {
        if (!r.ok) throw new Error('[HTPZkPipeline] submit failed: ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
