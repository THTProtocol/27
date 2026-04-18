// htp-match-deadline.js v1.0
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    // Start a deadline timer; onExpire called after ms milliseconds
    set: function(matchId, ms, onExpire) {
      this.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        delete _timers[matchId];
        if (typeof onExpire === 'function') onExpire(matchId);
      }, ms);
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
