// htp-match-deadline.js v1.0 — Match deadline stub
(function() {
  'use strict';
  window.HTPMatchDeadline = {
    set: function(matchId, daaScore) {
      try { localStorage.setItem('htp_dl_' + matchId, daaScore); } catch(e) {}
    },
    get: function(matchId) {
      try { return parseInt(localStorage.getItem('htp_dl_' + matchId)) || 0; } catch(e) { return 0; }
    },
    isExpired: function(matchId, currentDaa) {
      var dl = this.get(matchId);
      return dl > 0 && currentDaa > dl;
    },
    clear: function(matchId) {
      try { localStorage.removeItem('htp_dl_' + matchId); } catch(e) {}
    }
  };
  console.log('[HTP Match Deadline] loaded');
})();
