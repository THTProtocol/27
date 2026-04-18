/* htp-match-deadline.js — match deadline / DAA enforcement stub */
(function(){
  'use strict';
  var W = typeof window !== 'undefined' ? window : this;
  W.HTPMatchDeadline = {
    _timers: {},
    set: function(matchId, daaDeadline, onExpire) {
      clearTimeout(this._timers[matchId]);
      /* poll every 10s and call onExpire when DAA passes deadline */
      var self = this;
      this._timers[matchId] = setInterval(function(){
        var daa = W.HTP_CACHED_DAA || 0;
        if (daa >= daaDeadline) {
          clearInterval(self._timers[matchId]);
          if (typeof onExpire === 'function') onExpire(matchId);
        }
      }, 10000);
    },
    clear: function(matchId) {
      clearInterval(this._timers[matchId]);
      delete this._timers[matchId];
    }
  };
  console.log('[HTP Match Deadline] loaded');
})();
