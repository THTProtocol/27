/* htp-match-deadline.js — HTP Match Deadline stub v1.0
   Tracks per-match DAA deadlines and flags matches as abandoned
   after 30 s of no txId response.
*/
(function(){
  'use strict';
  console.log('[HTP Match Deadline] loaded');

  var W = window;
  var _timers = {};

  W.HTPMatchDeadline = {
    /**
     * Start a 30-second deadline for matchId.
     * onExpire(matchId) is called if no clearDeadline() arrives in time.
     */
    startDeadline: function(matchId, onExpire) {
      if (_timers[matchId]) clearTimeout(_timers[matchId]);
      _timers[matchId] = setTimeout(function() {
        delete _timers[matchId];
        console.warn('[HTP Match Deadline] match', matchId, 'timed out — flagging disputed');
        if (typeof onExpire === 'function') onExpire(matchId);
      }, 30000);
    },
    clearDeadline: function(matchId) {
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
})();
