/* HTP UTXO Mutex v1.0 — prevents double-spend on concurrent TX attempts */
(function() {
  window._htpUtxoLocks = window._htpUtxoLocks || {};
  window.htpAcquireUtxoLock = function(matchId) {
    if (window._htpUtxoLocks[matchId]) return false;
    window._htpUtxoLocks[matchId] = Date.now();
    return true;
  };
  window.htpReleaseUtxoLock = function(matchId) {
    delete window._htpUtxoLocks[matchId];
  };
  console.log('[HTP UTXO Mutex] loaded');
})();
