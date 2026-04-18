// htp-match-deadline.js v1.0
// Monitors active matches; flags them as abandoned if no move for 5 min
(function(){
  'use strict';
  var TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  var _timers = {};

  window.HTPMatchDeadline = {
    reset: function(matchId) {
      clearTimeout(_timers[matchId]);
      _timers[matchId] = setTimeout(function(){
        console.warn('[HTP Match Deadline] match', matchId, 'timed out — flagging abandoned');
        window.dispatchEvent(new CustomEvent('htp:match:timeout', { detail: { matchId: matchId } }));
      }, TIMEOUT_MS);
    },
    clear: function(matchId) {
      clearTimeout(_timers[matchId]);
      delete _timers[matchId];
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded — timeout:', TIMEOUT_MS / 1000, 's');
})();
