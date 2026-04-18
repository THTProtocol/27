// htp-match-deadline.js v1.0
// Flags matches as abandoned/disputed after timeout
(function(){
  'use strict';
  var ABANDON_MS = 5 * 60 * 1000; // 5 minutes no move
  var _timers = {};

  window.HTPMatchDeadline = {
    start: function(matchId, onTimeout) {
      this.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTPMatchDeadline] Match ' + matchId + ' timed out — flagging abandoned');
        if (typeof onTimeout === 'function') onTimeout(matchId);
        // Write disputed flag to Firebase if available
        try {
          var db = firebase.database();
          db.ref('matches/' + matchId).update({ status: 'disputed', disputedAt: Date.now() });
        } catch(e) {}
      }, ABANDON_MS);
    },
    reset: function(matchId, onTimeout) {
      // Reset timer on new move
      this.start(matchId, onTimeout);
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
