// htp-match-deadline.js v1.0
// Tracks match deadlines and auto-flags abandoned matches
(function(){
  'use strict';
  var MOVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  var _timers = {};
  window.HTPMatchDeadline = {
    start: function(matchId, onTimeout) {
      this.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match ' + matchId + ' timed out — no move in 5min');
        if (typeof onTimeout === 'function') onTimeout(matchId);
      }, MOVE_TIMEOUT_MS);
    },
    reset: function(matchId, onTimeout) {
      this.start(matchId, onTimeout);
    },
    clear: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
      }
    },
    clearAll: function() {
      Object.keys(_timers).forEach(function(id) {
        clearTimeout(_timers[id]);
      });
      _timers = {};
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
