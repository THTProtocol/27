/* htp-match-deadline.js — HTP Match Deadline stub v1.0
 * Tracks per-match DAA deadlines and flags expired matches.
 * Prevents 404/500 on script load.
 */
(function(){
  'use strict';
  console.log('[HTP Match Deadline] loaded');

  var _deadlines = {};

  window.HTPMatchDeadline = window.HTPMatchDeadline || {
    // Register a deadline (DAA score) for a match.
    set: function(matchId, deadlineDaa) {
      _deadlines[matchId] = deadlineDaa;
    },
    // Check if match has exceeded its DAA deadline.
    isExpired: function(matchId, currentDaa) {
      var d = _deadlines[matchId];
      if (d == null) return false;
      return currentDaa > d;
    },
    // Clear deadline entry after settlement.
    clear: function(matchId) {
      delete _deadlines[matchId];
    },
    // List all registered deadlines.
    all: function() {
      return Object.assign({}, _deadlines);
    }
  };
})();
