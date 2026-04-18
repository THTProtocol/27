/* htp-match-deadline.js — Match DAA deadline enforcer stub */
(function(){
  'use strict';
  console.log('[HTP Match Deadline] loaded');

  window.HTPMatchDeadline = {
    DEFAULT_BLOCKS: 3600,

    calc: function(currentDaa, offsetBlocks) {
      var offset = offsetBlocks || window.HTPMatchDeadline.DEFAULT_BLOCKS;
      return (currentDaa || 0) + offset;
    },

    isExpired: function(deadlineDaa, currentDaa) {
      return currentDaa >= deadlineDaa;
    },

    formatRemaining: function(deadlineDaa, currentDaa) {
      var remaining = deadlineDaa - currentDaa;
      if (remaining <= 0) return 'Expired';
      var secs = Math.round(remaining);  // ~1 block/s on TN12
      if (secs < 60) return secs + 's';
      if (secs < 3600) return Math.floor(secs/60) + 'm ' + (secs%60) + 's';
      return Math.floor(secs/3600) + 'h ' + Math.floor((secs%3600)/60) + 'm';
    }
  };
})();
