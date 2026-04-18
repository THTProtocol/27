// htp-match-deadline.js v1.0
// Monitors active matches for deadline expiry and triggers timeout payout
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    // Start a deadline timer for a match (default 1 hour = 3600000ms)
    start: function(matchId, durationMs, onExpire) {
      durationMs = durationMs || 3600000;
      if (_timers[matchId]) this.cancel(matchId);
      console.log('[HTP Match Deadline] Starting timer for', matchId, '—', durationMs / 60000, 'min');
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] EXPIRED:', matchId);
        delete _timers[matchId];
        if (typeof onExpire === 'function') onExpire(matchId);
      }, durationMs);
    },
    cancel: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
        console.log('[HTP Match Deadline] Cancelled:', matchId);
      }
    },
    cancelAll: function() {
      Object.keys(_timers).forEach(function(id) {
        clearTimeout(_timers[id]);
      });
      _timers = {};
    },
    active: function() {
      return Object.keys(_timers);
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
