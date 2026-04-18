/* HTP Match Deadline v1.0 — DAA-based match expiry */
(function(){
  window.HTPMatchDeadline = {
    check: function(matchId, deadlineDaa) {
      var cur = window._htpDaa || 0;
      return cur > deadlineDaa;
    },
    set: function(matchId, ttlBlocks) {
      var cur = window._htpDaa || 0;
      return cur + (ttlBlocks || 1000);
    }
  };
  console.log('[HTP Match Deadline] loaded');
})();
