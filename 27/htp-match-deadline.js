// htp-match-deadline.js v1.0
// Tracks per-match move deadlines; auto-flags abandoned matches
(function(){
  'use strict';
  var _timers = {};
  var TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes inactivity

  window.HTPMatchDeadline = {
    // Call on every move received for a match
    ping: function(matchId) {
      this.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match', matchId, 'timed out — no move for 5 min');
        var evt = new CustomEvent('htp:match:timeout', { detail: { matchId: matchId } });
        window.dispatchEvent(evt);
        delete _timers[matchId];
      }, TIMEOUT_MS);
    },
    // Clear deadline (match ended normally)
    clear: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
      }
    },
    // Clear all
    clearAll: function() {
      Object.keys(_timers).forEach(function(id) {
        clearTimeout(_timers[id]);
      });
      _timers = {};
    },
    active: function() { return Object.keys(_timers); }
  };
  console.log('[HTP Match Deadline v1.0] loaded — timeout:', TIMEOUT_MS / 1000 + 's');
})();
