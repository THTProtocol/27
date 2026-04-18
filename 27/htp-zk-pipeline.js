/* htp-zk-pipeline.js — HTP ZK Pipeline stub v1.0
   Provides a lightweight shim for ZK proof generation/verification
   until the full WASM ZK module is available.
*/
(function(){
  'use strict';
  console.log('[HTP ZK Pipeline] loaded');

  var W = window;

  W.HTPZKPipeline = {
    /**
     * Generate a proof commitment for a set of move hashes.
     * Returns a hex string (SHA-256-like commitment via SubtleCrypto).
     */
    commit: function(movesArr) {
      var data = JSON.stringify(movesArr);
      var buf  = new TextEncoder().encode(data);
      return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
        return Array.from(new Uint8Array(hashBuf))
          .map(function(b){ return b.toString(16).padStart(2,'0'); })
          .join('');
      });
    },
    /**
     * Verify a commitment matches a move list.
     */
    verify: function(movesArr, commitment) {
      return W.HTPZKPipeline.commit(movesArr).then(function(c) {
        return c === commitment;
      });
    }
  };
})();
