/* htp-zk-pipeline.js — HTP ZK Pipeline v1.0
 * Client-side ZK proof submission and verification pipeline.
 * Delegates heavy lifting to the Rust backend /zk/* endpoints.
 */
(function(){
  'use strict';
  var W = window;

  function api() {
    return W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
  }

  function post(path, body) {
    return fetch(api() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r){
      if (!r.ok) throw new Error('ZK API ' + path + ' returned ' + r.status);
      return r.json();
    });
  }

  W.HTPZkPipeline = {
    /**
     * Submit a ZK proof for oracle resolution.
     * @param {{ marketId, outcome, proof, publicInputs }} opts
     * @returns {Promise<{ verified: boolean, attestation: string }>}
     */
    submitOracleProof: function(opts) {
      return post('/zk/oracle/verify', opts);
    },

    /**
     * Submit a ZK proof for game outcome.
     * @param {{ matchId, winner, moveHash, proof }} opts
     * @returns {Promise<{ verified: boolean, txId?: string }>}
     */
    submitGameProof: function(opts) {
      return post('/zk/game/verify', opts);
    },

    /**
     * Verify a previously submitted proof by attestation ID.
     * @param {string} attestationId
     * @returns {Promise<{ valid: boolean, timestamp: number }>}
     */
    verifyAttestation: function(attestationId) {
      return fetch(api() + '/zk/attest/' + attestationId)
        .then(function(r){ return r.json(); });
    },

    /**
     * Health-check the ZK pipeline endpoint.
     * @returns {Promise<boolean>}
     */
    healthCheck: function() {
      return fetch(api() + '/zk/health', { method: 'GET' })
        .then(function(r){ return r.ok; })
        .catch(function(){ return false; });
    }
  };

  console.log('[HTP ZK Pipeline v1.0] loaded — backend: ' + api());
})();
