// htp-zk-pipeline.js v1.0
(function(){
  'use strict';
  window.HTPZkPipeline = {
    _api: window.HTP_RUST_API || 'https://htp-backend-production.up.railway.app',
    verifyMove: function(matchId, move, proof) {
      return fetch(this._api + '/zk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, move: move, proof: proof })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK verify failed: ' + r.status);
        return r.json();
      });
    },
    submitProof: function(matchId, gameLog) {
      return fetch(this._api + '/zk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId, gameLog: gameLog })
      }).then(function(r) {
        if (!r.ok) throw new Error('ZK submit failed: ' + r.status);
        return r.json();
      });
    }
  };
  console.log('[HTP ZK Pipeline v1.0] loaded');
})();
