/* htp-match-deadline.js — Match DAA deadline tracker v1.0 */
(function() {
  'use strict';
  console.log('[HTP Match Deadline] loaded');

  window.HTPMatchDeadline = {
    /* DAA blocks per hour on Kaspa ~3600 (1 block/sec) */
    BLOCKS_PER_HOUR: 3600,

    /** Return the deadline DAA score given match creation DAA + hours */
    calc: function(creationDaa, hours) {
      return creationDaa + (hours * this.BLOCKS_PER_HOUR);
    },

    /** Returns true if current DAA has passed the deadline */
    isPast: function(deadlineDaa, currentDaa) {
      return currentDaa >= deadlineDaa;
    },

    /** Remaining blocks until deadline (0 if past) */
    remaining: function(deadlineDaa, currentDaa) {
      return Math.max(0, deadlineDaa - currentDaa);
    },

    /** Human readable remaining time string */
    remainingStr: function(deadlineDaa, currentDaa) {
      var blocks = this.remaining(deadlineDaa, currentDaa);
      if (blocks === 0) return 'Expired';
      var mins = Math.floor(blocks / 60);
      var hrs  = Math.floor(mins / 60);
      mins = mins % 60;
      if (hrs > 0) return hrs + 'h ' + mins + 'm';
      return mins + 'm';
    }
  };
})();
