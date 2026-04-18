// htp-match-deadline.js v1.0
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    set: function(matchId, seconds, onExpire) {
      this.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        delete _timers[matchId];
        if (typeof onExpire === 'function') onExpire(matchId);
      }, seconds * 1000);
    },
    clear: function(matchId) {
      if (_timers[matchId]) { clearTimeout(_timers[matchId]); delete _timers[matchId]; }
    },
    clearAll: function() {
      Object.keys(_timers).forEach(function(id) { clearTimeout(_timers[id]); });
      _timers = {};
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
