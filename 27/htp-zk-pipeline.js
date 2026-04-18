/* htp-zk-pipeline.js — ZK proof pipeline shim v1.0 */
(function() {
  'use strict';
  console.log('[HTP ZK Pipeline] loaded');

  var RUST_API = window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  window.HTPZkPipeline = {
    /**
     * Submit game transcript to Rust backend for ZK proof generation.
     * Returns promise resolving to { proofId, status }
     */
    submitTranscript: function(matchId, transcript) {
      return fetch(RUST_API + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, transcript: transcript })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK submit failed: ' + r.status);
        return r.json();
      });
    },

    /**
     * Poll proof status by proofId.
     * Returns promise resolving to { status: 'pending'|'ready'|'failed', proof? }
     */
    pollStatus: function(proofId) {
      return fetch(RUST_API + '/zk/status/' + proofId)
        .then(function(r) {
          if (!r.ok) throw new Error('ZK poll failed: ' + r.status);
          return r.json();
        });
    },

    /**
     * Verify a proof on-chain via Rust backend.
     * Returns promise resolving to { verified: bool, txId? }
     */
    verify: function(proofId) {
      return fetch(RUST_API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofId: proofId })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      });
    }
  };
})();
