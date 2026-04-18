/* htp-match-deadline.js — HTP Match Deadline stub v1.0
   Tracks per-match DAA deadlines and fires htp:match:expired when overdue. */
(function(){
  'use strict';
  console.log('[HTP Match Deadline] loaded');

  var _deadlines = {};

  window.HTPMatchDeadline = {
    set: function(matchId, daaDeadline) {
      _deadlines[matchId] = daaDeadline;
    },
    get: function(matchId) {
      return _deadlines[matchId] || null;
    },
    isExpired: function(matchId, currentDaa) {
      var d = _deadlines[matchId];
      if (!d) return false;
      return currentDaa >= d;
    },
    checkAll: function(currentDaa) {
      Object.keys(_deadlines).forEach(function(id) {
        if (currentDaa >= _deadlines[id]) {
          window.dispatchEvent(new CustomEvent('htp:match:expired', { detail: { matchId: id } }));
          delete _deadlines[id];
        }
      });
    }
  };
})();
