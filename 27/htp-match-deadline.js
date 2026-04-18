// htp-match-deadline.js v1.0
// Monitors active matches and flags abandoned ones after timeout
(function(){
  'use strict';
  var TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes no move = abandoned
  var _timers = {};

  window.HTPMatchDeadline = {
    start: function(matchId, onExpire) {
      window.HTPMatchDeadline.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match', matchId, 'timed out — flagging abandoned');
        if (typeof onExpire === 'function') onExpire(matchId);
      }, TIMEOUT_MS);
    },
    reset: function(matchId, onExpire) {
      window.HTPMatchDeadline.start(matchId, onExpire);
    },
    clear: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
      }
    },
    clearAll: function() {
      Object.keys(_timers).forEach(function(id) {
        window.HTPMatchDeadline.clear(id);
      });
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded — timeout:', TIMEOUT_MS / 1000, 's');
})();
