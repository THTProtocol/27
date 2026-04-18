/* HTP ZK Pipeline v1.0 — stub, ZK proof submission via Rust backend */
(function(){
  window.HTPZkPipeline = {
    submit: function(matchId, proof, outcome) {
      return fetch(window.HTP_RUST_API + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, proof: proof, outcome: outcome })
      }).then(function(r){ return r.json(); });
    }
  };
  console.log('[HTP ZK Pipeline] loaded');
})();
