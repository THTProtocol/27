/* htp-match-deadline.js v1.0 — DAA-based match deadline enforcement */
(function(){
  'use strict';
  var W = window;
  W.HTPMatchDeadline = {
    DEFAULT_BLOCKS: 1000,
    set: function(matchId, daaScore, blocks) {
      var deadline = daaScore + (blocks || this.DEFAULT_BLOCKS);
      try { localStorage.setItem('htp_dl_' + matchId, deadline); } catch(e){}
      return deadline;
    },
    get: function(matchId) {
      try { return parseInt(localStorage.getItem('htp_dl_' + matchId) || '0'); } catch(e){ return 0; }
    },
    isExpired: function(matchId, currentDaa) {
      var dl = this.get(matchId);
      return dl > 0 && currentDaa > dl;
    },
    clear: function(matchId) {
      try { localStorage.removeItem('htp_dl_' + matchId); } catch(e){}
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})();
