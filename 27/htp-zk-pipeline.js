/* htp-zk-pipeline.js — HTP ZK Pipeline v1.0 */
(function(){
  'use strict';
  var W = window;

  W.HTPZkPipeline = {
    _rustApi: W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app',

    // Generate a ZK proof for a game outcome
    generateProof: function(matchId, moves, outcome) {
      console.log('[HTP ZK] Generating proof for match:', matchId);
      return fetch(this._rustApi + '/zk/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, moves: moves, outcome: outcome })
      })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('ZK prove failed: ' + r.status)); })
      .then(function(data) {
        console.log('[HTP ZK] Proof generated:', data.proofHash);
        return data;
      })
      .catch(function(e) {
        console.warn('[HTP ZK] Proof generation failed (stub fallback):', e.message);
        // Stub fallback — returns a mock proof so the app doesnt crash
        return { proofHash: 'stub-proof-' + matchId, verified: false, stub: true };
      });
    },

    // Verify a ZK proof on-chain
    verifyProof: function(proofHash) {
      console.log('[HTP ZK] Verifying proof:', proofHash);
      if (proofHash && proofHash.startsWith('stub-proof-')) {
        console.warn('[HTP ZK] Stub proof — skipping verification');
        return Promise.resolve({ verified: false, stub: true });
      }
      return fetch(this._rustApi + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofHash: proofHash })
      })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('ZK verify failed: ' + r.status)); })
      .catch(function(e) {
        console.warn('[HTP ZK] Verification failed:', e.message);
        return { verified: false, error: e.message };
      });
    }
  };

  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
