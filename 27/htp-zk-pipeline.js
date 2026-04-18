/* htp-zk-pipeline.js — stub v1.0 */
(function(){
  'use strict';
  console.log('[HTP ZK Pipeline] stub loaded');
  window.HTPZkPipeline = window.HTPZkPipeline || {
    verify: function(proof, publicInputs) {
      console.log('[HTP ZK Pipeline] verify called (stub — delegating to Rust API)');
      return Promise.resolve({ valid: true, stub: true });
    },
    generate: function(witness) {
      console.log('[HTP ZK Pipeline] generate called (stub)');
      return Promise.resolve({ proof: null, stub: true });
    },
    version: '1.0-stub'
  };
})();
