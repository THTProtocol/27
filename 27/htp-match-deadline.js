/* HTP Match Deadline v1.0 — DAA-based match expiry */
(function() {
  window.htpCheckMatchDeadline = function(matchId, deadlineDaa) {
    var currentDaa = window._htpDaaCache || 0;
    if (!deadlineDaa || !currentDaa) return false;
    return currentDaa > deadlineDaa;
  };
  console.log('[HTP Match Deadline] loaded');
})();
