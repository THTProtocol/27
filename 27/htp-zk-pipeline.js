// htp-zk-pipeline.js v1.0
// ZK proof pipeline shim — submits move proofs to Rust backend for verification
(function(){
  'use strict';
  var API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    // Submit a game-move proof for on-chain verification
    submitMoveProof: function(matchId, moveData, network) {
      return fetch(API + '/zk/verify-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, move: moveData, network: network || 'tn12' })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      });
    },
    // Submit a game-outcome proof
    submitOutcomeProof: function(matchId, outcome, network) {
      return fetch(API + '/zk/verify-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, outcome: outcome, network: network || 'tn12' })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK outcome verify failed: ' + r.status);
        return r.json();
      });
    },
    // Graceful no-op if backend is offline
    trySubmitMoveProof: function(matchId, moveData, network) {
      return this.submitMoveProof(matchId, moveData, network).catch(function(e) {
        console.warn('[HTP ZK Pipeline] Move proof skipped (backend offline):', e.message);
        return { verified: false, skipped: true };
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
