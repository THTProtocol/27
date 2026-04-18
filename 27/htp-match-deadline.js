// htp-match-deadline.js v1.0
(function(){
  'use strict';
  var _timers = {};
  window.HTPMatchDeadline = {
    // DAA blocks per second ~1, default 24h deadline = 86400 blocks
    DEFAULT_BLOCKS: 86400,
    set: function(matchId, daaDeadline, onExpire) {
      this.clear(matchId);
      var now = window._htpDaaScore || 0;
      if (!now || !daaDeadline) return;
      var remaining = (daaDeadline - now) * 1000; // approx ms
      if (remaining <= 0) { onExpire && onExpire(matchId); return; }
      _timers[matchId] = setTimeout(function() {
        console.log('[HTP Match Deadline] Expired:', matchId);
        onExpire && onExpire(matchId);
      }, Math.min(remaining, 2147483647));
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
