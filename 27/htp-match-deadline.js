/* htp-match-deadline.js — stub v1.0 */
(function(){
  'use strict';
  console.log('[HTP Match Deadline] stub loaded');
  window.HTPMatchDeadline = window.HTPMatchDeadline || {
    _timers: {},
    set: function(matchId, ms, cb) {
      this.clear(matchId);
      this._timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] expired:', matchId);
        if (typeof cb === 'function') cb(matchId);
      }, ms);
    },
    clear: function(matchId) {
      if (this._timers[matchId]) {
        clearTimeout(this._timers[matchId]);
        delete this._timers[matchId];
      }
    },
    version: '1.0-stub'
  };
})();
