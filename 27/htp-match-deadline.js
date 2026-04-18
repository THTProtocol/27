// htp-match-deadline.js v1.0
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    set: function(matchId, deadlineDaaOrMs, onExpire) {
      if (_timers[matchId]) clearTimeout(_timers[matchId]);
      var delayMs = typeof deadlineDaaOrMs === 'number' && deadlineDaaOrMs > 1000000
        ? deadlineDaaOrMs
        : (deadlineDaaOrMs * 1000);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match', matchId, 'deadline reached');
        delete _timers[matchId];
        if (typeof onExpire === 'function') onExpire(matchId);
      }, delayMs);
      console.log('[HTP Match Deadline] Set deadline for', matchId, 'in', delayMs, 'ms');
    },
    clear: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
        console.log('[HTP Match Deadline] Cleared deadline for', matchId);
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
