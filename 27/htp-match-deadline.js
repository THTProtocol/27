/* htp-match-deadline.js — Match deadline / timeout enforcement
 * Watches active matches; if no move arrives within the timeout window
 * the match is flagged as abandoned and the present player wins on time.
 */
(function(){
  'use strict';
  console.log('[HTP Match Deadline] loaded');

  var MOVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes default
  var _timers = {};

  window.HTPMatchDeadline = {
    /**
     * (Re)start the inactivity clock for a match.
     * @param {string} matchId
     * @param {function} onTimeout  called with matchId when clock expires
     * @param {number}   [ms]       override default timeout (ms)
     */
    reset: function(matchId, onTimeout, ms) {
      this.clear(matchId);
      _timers[matchId] = setTimeout(function() {
        console.warn('[HTP Match Deadline] timeout for', matchId);
        if (typeof onTimeout === 'function') onTimeout(matchId);
      }, ms || MOVE_TIMEOUT_MS);
    },

    /** Cancel the clock (called on move received or game over). */
    clear: function(matchId) {
      if (_timers[matchId]) {
        clearTimeout(_timers[matchId]);
        delete _timers[matchId];
      }
    },

    /** Clear all active timers (e.g. on page unload). */
    clearAll: function() {
      Object.keys(_timers).forEach(function(id) {
        clearTimeout(_timers[id]);
      });
      _timers = {};
    }
  };
})();
