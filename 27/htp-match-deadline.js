// htp-match-deadline.js v1.0
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    set: function(matchId, deadlineDaaScore, onExpire) {
      if (_timers[matchId]) clearTimeout(_timers[matchId]);
      var checkInterval = 15000;
      var self = this;
      function check() {
        var currentDaa = window.HTP_DAA_SCORE || 0;
        if (currentDaa >= deadlineDaaScore) {
          console.warn('[HTP Match Deadline] Match', matchId, 'expired at DAA', currentDaa);
          delete _timers[matchId];
          if (typeof onExpire === 'function') onExpire(matchId);
        } else {
          _timers[matchId] = setTimeout(check, checkInterval);
        }
      }
      _timers[matchId] = setTimeout(check, checkInterval);
      console.log('[HTP Match Deadline] Watching match', matchId, 'deadline DAA:', deadlineDaaScore);
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
