// htp-zk-pipeline.js v1.0
(function(){
  'use strict';
  window.HTPZkPipeline = {
    // Verify a ZK proof via Rust backend
    verify: function(proof, publicInputs) {
      var api = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: proof, public_inputs: publicInputs })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      });
    },
    // Generate a ZK proof for a game result
    prove: function(gameId, moveLog, result) {
      var api = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, moves: moveLog, result: result })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK prove failed: ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
