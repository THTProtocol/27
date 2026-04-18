/* htp-match-deadline.js — HTP Match Deadline stub v1.0 */
(function() {
  'use strict';
  console.log('[HTP Match Deadline] loaded');
  window.HTPMatchDeadline = {
    set: function(matchId, daaDeadline) {
      try {
        localStorage.setItem('htp_deadline_' + matchId, daaDeadline);
      } catch(e) {}
    },
    get: function(matchId) {
      try {
        return parseInt(localStorage.getItem('htp_deadline_' + matchId)) || 0;
      } catch(e) { return 0; }
    },
    clear: function(matchId) {
      try { localStorage.removeItem('htp_deadline_' + matchId); } catch(e) {}
    },
    isPast: function(matchId, currentDaa) {
      var dl = this.get(matchId);
      return dl > 0 && currentDaa >= dl;
    }
  };
})();
