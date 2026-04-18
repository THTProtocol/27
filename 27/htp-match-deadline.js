// htp-match-deadline.js v1.0
// Tracks match DAA deadlines and auto-flags expired matches
(function(){
  'use strict';
  var DEFAULT_DEADLINE_BLOCKS = 1440; // ~2 hours on TN12

  window.HTPMatchDeadline = {
    compute: function(currentDaa, extraBlocks) {
      return (currentDaa || 0) + (extraBlocks || DEFAULT_DEADLINE_BLOCKS);
    },
    isExpired: function(deadlineDaa, currentDaa) {
      if (!deadlineDaa || !currentDaa) return false;
      return currentDaa > deadlineDaa;
    },
    label: function(deadlineDaa, currentDaa) {
      if (!deadlineDaa) return 'No deadline';
      var diff = deadlineDaa - (currentDaa || 0);
      if (diff <= 0) return 'EXPIRED';
      var mins = Math.round(diff); // ~1s per block on TN12
      if (mins < 60) return mins + ' blocks remaining';
      return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm remaining';
    },
    watchMatch: function(matchId, deadlineDaa, onExpire) {
      var self = this;
      var iv = setInterval(function() {
        var daa = window._htpDaaCache && window._htpDaaCache['tn12'];
        if (!daa) return;
        if (self.isExpired(deadlineDaa, daa)) {
          clearInterval(iv);
          console.warn('[HTP Match Deadline] Match ' + matchId + ' expired at DAA ' + daa);
          if (typeof onExpire === 'function') onExpire(matchId);
        }
      }, 10000);
      return function() { clearInterval(iv); };
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
