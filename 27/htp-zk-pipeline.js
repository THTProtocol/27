/* htp-zk-pipeline.js v1.0 — ZK proof pipeline stub (full impl via Rust backend) */
(function(){
  'use strict';
  var W = window;
  var API = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  W.HTPZkPipeline = {
    /**
     * Submit a ZK proof to the Rust backend for verification.
     * @param {object} opts - { matchId, gameHash, moves, winner }
     * @returns {Promise<{verified: boolean, proofId: string}>}
     */
    verify: function(opts) {
      return fetch(API + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      })
      .then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] verify error:', e.message);
        return { verified: false, proofId: null, error: e.message };
      });
    },

    /**
     * Generate a ZK proof for a completed game.
     * @param {object} opts - { matchId, moves, result }
     * @returns {Promise<{proofId: string, proofHex: string}>}
     */
    generate: function(opts) {
      return fetch(API + '/zk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      })
      .then(function(r) {
        if (!r.ok) throw new Error('ZK generate failed: ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] generate error:', e.message);
        return { proofId: null, proofHex: null, error: e.message };
      });
    },

    /**
     * Attest an oracle result with ZK proof.
     * @param {object} opts - { marketId, outcome, bondAmount, oracleAddress }
     * @returns {Promise<{attested: boolean, txId: string}>}
     */
    attestOracle: function(opts) {
      return fetch(API + '/zk/oracle-attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts)
      })
      .then(function(r) {
        if (!r.ok) throw new Error('ZK oracle attest failed: ' + r.status);
        return r.json();
      })
      .catch(function(e) {
        console.warn('[HTP ZK Pipeline] oracle attest error:', e.message);
        return { attested: false, txId: null, error: e.message };
      });
    }
  };

  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
