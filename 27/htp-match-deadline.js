// htp-match-deadline.js v1.0
(function(){
  'use strict';
  window.HTPMatchDeadline = {
    DEFAULT_TIMEOUT_MS: 5 * 60 * 1000,
    _timers: {},
    set: function(matchId, onExpire, timeoutMs) {
      this.clear(matchId);
      var ms = timeoutMs || this.DEFAULT_TIMEOUT_MS;
      this._timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] Match ' + matchId + ' timed out');
        if (typeof onExpire === 'function') onExpire(matchId);
      }, ms);
      console.log('[HTP Match Deadline] Set for', matchId, 'in', ms / 1000, 's');
    },
    clear: function(matchId) {
      if (this._timers[matchId]) {
        clearTimeout(this._timers[matchId]);
        delete this._timers[matchId];
      }
    },
    clearAll: function() {
      var self = this;
      Object.keys(this._timers).forEach(function(id) { self.clear(id); });
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
