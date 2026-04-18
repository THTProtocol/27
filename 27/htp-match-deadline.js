// htp-match-deadline.js v1.0
// Monitors active matches and triggers timeout payout if deadline passes
(function(){
  'use strict';
  var _timers = {};
  var DEADLINE_MS = 30 * 60 * 1000; // 30 minutes default

  window.HTPMatchDeadline = {
    start: function(matchId, stakeKas, onExpire) {
      if (_timers[matchId]) return;
      console.log('[HTP Match Deadline] Starting timer for', matchId);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match', matchId, 'expired — triggering timeout payout');
        delete _timers[matchId];
        if (typeof onExpire === 'function') onExpire(matchId, stakeKas);
      }, DEADLINE_MS);
    },
    cancel: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
        console.log('[HTP Match Deadline] Timer cancelled for', matchId);
      }
    },
    setDeadlineMs: function(ms) {
      DEADLINE_MS = ms;
    },
    active: function() {
      return Object.keys(_timers);
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
