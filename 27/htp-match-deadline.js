/* htp-match-deadline.js — HTP Match Deadline v1.0 */
(function(){
  'use strict';
  console.log('[HTP Match Deadline v1.0] loaded');

  var W = window;
  var _timers = {};

  /**
   * Set a deadline timer for a match.
   * @param {string} matchId
   * @param {number} ms - milliseconds until deadline fires
   * @param {Function} onExpire - called when deadline hits
   */
  function set(matchId, ms, onExpire) {
    clear(matchId);
    _timers[matchId] = setTimeout(function() {
      delete _timers[matchId];
      console.log('[HTP Match Deadline] Match', matchId, 'expired after', ms, 'ms');
      if (typeof onExpire === 'function') onExpire(matchId);
    }, ms);
    console.log('[HTP Match Deadline] Set for', matchId, 'in', ms, 'ms');
  }

  /**
   * Clear a deadline timer.
   */
  function clear(matchId) {
    if (_timers[matchId]) {
      clearTimeout(_timers[matchId]);
      delete _timers[matchId];
    }
  }

  /**
   * Check if a deadline is active.
   */
  function isActive(matchId) {
    return !!_timers[matchId];
  }

  W.HTPMatchDeadline = { set: set, clear: clear, isActive: isActive };
})();
