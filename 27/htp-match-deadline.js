// htp-match-deadline.js v1.0
// Tracks match deadlines and triggers timeout payouts
(function(){
  'use strict';
  var _timers = {};
  var TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes default

  window.HTPMatchDeadline = {
    set: function(matchId, onTimeout, msOverride) {
      this.clear(matchId);
      var ms = msOverride || TIMEOUT_MS;
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Timeout fired for match:', matchId);
        if (typeof onTimeout === 'function') onTimeout(matchId);
        delete _timers[matchId];
      }, ms);
      console.log('[HTP Match Deadline] Set for', matchId, '— expires in', ms / 1000, 's');
    },
    reset: function(matchId, onTimeout, msOverride) {
      this.set(matchId, onTimeout, msOverride);
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
