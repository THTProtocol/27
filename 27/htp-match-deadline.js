// htp-match-deadline.js v1.0
// Flags matches as disputed if no TX within deadline
(function(){
  'use strict';
  var DEADLINE_MS = 30000; // 30 seconds
  var _timers = {};

  window.HTPMatchDeadline = {
    start: function(matchId, onTimeout) {
      if (_timers[matchId]) clearTimeout(_timers[matchId]);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] matchId=' + matchId + ' timed out — flagging as disputed');
        delete _timers[matchId];
        if (typeof onTimeout === 'function') onTimeout(matchId);
        // Write disputed flag to Firebase if available
        try {
          var db = window.firebase && window.firebase.database && window.firebase.database();
          if (db) {
            db.ref('relay/' + matchId + '/result').once('value').then(function(snap) {
              if (!snap.val() || !snap.val().txId) {
                db.ref('relay/' + matchId + '/disputed').set(true);
              }
            });
          }
        } catch(e) {}
      }, DEADLINE_MS);
      console.log('[HTP Match Deadline] started for', matchId, '(' + DEADLINE_MS + 'ms)');
    },
    cancel: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
        console.log('[HTP Match Deadline] cancelled for', matchId);
      }
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded — dispute timeout: ' + DEADLINE_MS + 'ms');
})();
