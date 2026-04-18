// htp-match-deadline.js v1.0
// Tracks per-match DAA deadlines and triggers timeout payouts
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    set: function(matchId, deadlineDaa, onExpire) {
      if (_timers[matchId]) clearTimeout(_timers[matchId]);
      var pollMs = 15000;
      var self = this;
      function poll() {
        var currentDaa = window._htpDaa || 0;
        if (currentDaa >= deadlineDaa) {
          console.warn('[HTP Deadline] Match ' + matchId + ' expired at DAA ' + currentDaa);
          delete _timers[matchId];
          if (typeof onExpire === 'function') onExpire(matchId);
        } else {
          _timers[matchId] = setTimeout(poll, pollMs);
        }
      }
      _timers[matchId] = setTimeout(poll, pollMs);
      console.log('[HTP Deadline] Watching match ' + matchId + ' until DAA ' + deadlineDaa);
    },
    clear: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
      }
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
