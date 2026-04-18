<<<<<<< HEAD
/* htp-zk-pipeline.js v1.0 — ZK proof pipeline stub for oracle attestation */
(function(){
  'use strict';
  var W = window;
  W.HTPZkPipeline = {
    VERSION: '1.0',
    /* Submit a ZK proof for oracle resolution.
     * In production this calls the Rust backend /oracle/zk/submit.
     * Here we provide a graceful stub so the page loads without crashing. */
    submit: function(opts) {
      var base = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(base + '/oracle/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts || {})
      })
      .then(function(r){ return r.json(); })
      .catch(function(e){
        console.warn('[HTP ZK Pipeline] submit error:', e.message);
        return { ok: false, error: e.message };
      });
    },
    /* Verify a previously submitted ZK proof */
    verify: function(proofId) {
      var base = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(base + '/oracle/zk/verify/' + encodeURIComponent(proofId))
      .then(function(r){ return r.json(); })
      .catch(function(e){
        console.warn('[HTP ZK Pipeline] verify error:', e.message);
        return { ok: false, error: e.message };
      });
    },
    /* Check pipeline health */
    health: function() {
      var base = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(base + '/oracle/zk/health')
      .then(function(r){ return r.ok; })
      .catch(function(){ return false; });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
=======
/* HTP ZK Pipeline v1.0 — ZK proof stub for oracle attestation */
(function(W){
  'use strict';
  W.HTPZkPipeline = {
    version: '1.0',
    generateProof: function(marketId, outcome, oracleAddr) {
      return Promise.resolve({
        marketId: marketId,
        outcome: outcome,
        oracle: oracleAddr,
        proof: 'zk_stub_' + Date.now(),
        ts: Date.now()
      });
    },
    verifyProof: function(proofObj) {
      return Promise.resolve(!!(proofObj && proofObj.proof && proofObj.oracle));
    },
    submitOnChain: function(proofObj) {
      var api = W.HTP_RUST_API || 'https://htp-backend-production.up.railway.app';
      return fetch(api + '/oracle/zk-submit', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(proofObj)
      }).then(function(r){ return r.json(); });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})(window);
>>>>>>> d3fb362 (fix: add 4 missing JS modules, silence /deadline/daa 500 errors)
