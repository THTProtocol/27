/* htp-match-deadline.js — HTP Match Deadline v1.0 */
(function(){
  'use strict';
  var W = window;
  var _deadlines = {};

  W.HTPMatchDeadline = {
    TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes default

    set: function(matchId, timeoutMs) {
      var ms = timeoutMs || this.TIMEOUT_MS;
      if (_deadlines[matchId]) clearTimeout(_deadlines[matchId].timer);
      var deadline = Date.now() + ms;
      var timer = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match timed out:', matchId);
        W.dispatchEvent(new CustomEvent('htp:match:timeout', { detail: { matchId: matchId } }));
        delete _deadlines[matchId];
      }, ms);
      _deadlines[matchId] = { deadline: deadline, timer: timer };
      console.log('[HTP Match Deadline] Set deadline for', matchId, 'in', ms/1000, 's');
    },

    clear: function(matchId) {
      if (_deadlines[matchId]) {
        clearTimeout(_deadlines[matchId].timer);
        delete _deadlines[matchId];
        console.log('[HTP Match Deadline] Cleared deadline for', matchId);
      }
    },

    remaining: function(matchId) {
      if (!_deadlines[matchId]) return 0;
      return Math.max(0, _deadlines[matchId].deadline - Date.now());
    },

    isExpired: function(matchId) {
      return this.remaining(matchId) === 0;
    }
  };

  console.log('[HTP Match Deadline v1.0] loaded');
})();
