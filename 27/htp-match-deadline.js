/* htp-match-deadline.js — HTP Match Deadline v1.0
 * Tracks per-match DAA deadlines and fires timeout callbacks.
 */
(function(){
  'use strict';
  var W = window;

  var _deadlines = {}; // matchId -> { daaDeadline, timerId, cb }
  var POLL_MS    = 15000; // check every 15s

  function currentDaa() {
    // Use cached DAA from init module if available
    if (W.HTP_DAA_SCORE) return W.HTP_DAA_SCORE;
    if (W._htpDaaCache) {
      var v = Object.values(W._htpDaaCache)[0];
      if (v) return parseInt(v, 10);
    }
    return 0;
  }

  function check() {
    var now = currentDaa();
    if (!now) return;
    Object.keys(_deadlines).forEach(function(mid) {
      var d = _deadlines[mid];
      if (now >= d.daaDeadline) {
        console.warn('[HTP Match Deadline] match ' + mid + ' expired at DAA ' + d.daaDeadline);
        try { d.cb(mid, now, d.daaDeadline); } catch(e){}
        delete _deadlines[mid];
      }
    });
  }

  var _pollTimer = setInterval(check, POLL_MS);

  W.HTPMatchDeadline = {
    /**
     * Register a deadline for a match.
     * @param {string}   matchId
     * @param {number}   daaDeadline  - DAA score at which match expires
     * @param {Function} onExpired    - callback(matchId, currentDaa, deadline)
     */
    register: function(matchId, daaDeadline, onExpired) {
      _deadlines[matchId] = { daaDeadline: daaDeadline, cb: onExpired };
    },

    cancel: function(matchId) {
      delete _deadlines[matchId];
    },

    isExpired: function(matchId) {
      var d = _deadlines[matchId];
      if (!d) return false;
      return currentDaa() >= d.daaDeadline;
    },

    list: function() { return Object.assign({}, _deadlines); }
  };

  console.log('[HTP Match Deadline v1.0] loaded — polling every ' + (POLL_MS/1000) + 's');
})();
