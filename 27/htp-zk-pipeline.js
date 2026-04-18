/* htp-zk-pipeline.js — HTP ZK Pipeline v1.0 */
(function(){
  'use strict';
  console.log('[HTP ZK Pipeline v1.0] loaded');

  var W = window;
  var RUST_API = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';

  /**
   * Submit a ZK proof for oracle resolution.
   * @param {object} params - { marketId, outcome, proof, publicInputs }
   * @returns {Promise<{ verified: boolean, txId?: string }>}
   */
  function submitProof(params) {
    return fetch(RUST_API + '/zk/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    .then(function(r) { return r.json(); })
    .catch(function(e) {
      console.warn('[HTP ZK Pipeline] submitProof error:', e.message);
      return { verified: false, error: e.message };
    });
  }

  /**
   * Verify a ZK proof without submitting.
   * @param {object} params - { proof, publicInputs, circuit }
   * @returns {Promise<{ valid: boolean }>}
   */
  function verifyProof(params) {
    return fetch(RUST_API + '/zk/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    .then(function(r) { return r.json(); })
    .catch(function(e) {
      console.warn('[HTP ZK Pipeline] verifyProof error:', e.message);
      return { valid: false, error: e.message };
    });
  }

  /**
   * Get proof status.
   */
  function getProofStatus(proofId) {
    return fetch(RUST_API + '/zk/status/' + proofId)
      .then(function(r) { return r.json(); })
      .catch(function(e) { return { status: 'unknown', error: e.message }; });
  }

  W.HTPZkPipeline = {
    submitProof: submitProof,
    verifyProof: verifyProof,
    getProofStatus: getProofStatus
  };
})();
