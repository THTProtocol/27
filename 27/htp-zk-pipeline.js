// htp-zk-pipeline.js v1.0
// ZK proof pipeline shim — submits move proofs to Rust backend for verification
(function(){
  'use strict';
  var BASE = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    // Submit a move proof for on-chain verification
    submitMoveProof: async function(matchId, moveData) {
      try {
        var resp = await fetch(BASE + '/zk/prove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: matchId, move: moveData })
        });
        if (!resp.ok) throw new Error('ZK prove failed: ' + resp.status);
        return await resp.json();
      } catch(e) {
        console.warn('[HTP ZK Pipeline] submitMoveProof error:', e.message);
        return null;
      }
    },
    // Verify a proof returned from the backend
    verifyProof: async function(proof) {
      try {
        var resp = await fetch(BASE + '/zk/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proof: proof })
        });
        if (!resp.ok) throw new Error('ZK verify failed: ' + resp.status);
        var result = await resp.json();
        return result.valid === true;
      } catch(e) {
        console.warn('[HTP ZK Pipeline] verifyProof error:', e.message);
        return false;
      }
    },
    // Verify final game outcome proof (used by settlement engine)
    verifyOutcome: async function(matchId, outcome) {
      try {
        var resp = await fetch(BASE + '/zk/outcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: matchId, outcome: outcome })
        });
        if (!resp.ok) throw new Error('ZK outcome failed: ' + resp.status);
        return await resp.json();
      } catch(e) {
        console.warn('[HTP ZK Pipeline] verifyOutcome error:', e.message);
        return null;
      }
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded — backend:', BASE);
})();
