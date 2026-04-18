// htp-match-deadline.js v1.0
// Handles match deadlines: if no move for N minutes, flag abandoned and trigger payout
(function(){
  'use strict';
  var DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  var _timers = {};

  window.HTPMatchDeadline = {
    start: function(matchId, onExpire, timeoutMs) {
      this.cancel(matchId);
      var ms = timeoutMs || DEFAULT_TIMEOUT_MS;
      _timers[matchId] = setTimeout(function() {
        delete _timers[matchId];
        console.warn('[HTP Match Deadline] Match', matchId, 'timed out after', ms / 1000, 's');
        if (typeof onExpire === 'function') onExpire(matchId);
      }, ms);
      console.log('[HTP Match Deadline] Timer started for', matchId, '(' + ms / 1000 + 's)');
    },
    reset: function(matchId, onExpire, timeoutMs) {
      this.start(matchId, onExpire, timeoutMs);
    },
    cancel: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
        console.log('[HTP Match Deadline] Timer cancelled for', matchId);
      }
    },
    cancelAll: function() {
      Object.keys(_timers).forEach(function(id) {
        clearTimeout(_timers[id]);
      });
      _timers = {};
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
