/* htp-zk-pipeline.js — ZK proof pipeline stub */
(function(){
  'use strict';
  var W = typeof window !== 'undefined' ? window : this;
  W.HTPZkPipeline = {
    /* Stub: real ZK proof generation proxied to Rust backend */
    generateProof: async function(matchId, moves, outcome) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      try {
        var r = await fetch(api + '/zk/prove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: matchId, moves: moves, outcome: outcome })
        });
        if (!r.ok) throw new Error('ZK prove HTTP ' + r.status);
        return await r.json();
      } catch(e) {
        console.warn('[HTP ZK Pipeline] proof generation failed:', e.message);
        return { proof: null, error: e.message };
      }
    },
    verifyProof: async function(proof) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      try {
        var r = await fetch(api + '/zk/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proof: proof })
        });
        if (!r.ok) throw new Error('ZK verify HTTP ' + r.status);
        return await r.json();
      } catch(e) {
        console.warn('[HTP ZK Pipeline] verify failed:', e.message);
        return { valid: false, error: e.message };
      }
    }
  };
  console.log('[HTP ZK Pipeline] loaded');
})();
