<<<<<<< HEAD
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
=======
/* HTP Match Deadline v1.0 — DAA-based deadline enforcement */
(function(W){
  'use strict';
  W.HTPMatchDeadline = {
    BLOCKS_PER_HOUR: 3600,
    setDeadline: function(matchId, hoursFromNow) {
      var daa = W._htpDaaScore || 0;
      var deadline = daa + (hoursFromNow * this.BLOCKS_PER_HOUR);
      try { localStorage.setItem('htp_deadline_' + matchId, String(deadline)); } catch(e){}
      return deadline;
    },
    isExpired: function(matchId) {
      var daa = W._htpDaaScore || 0;
      try {
        var dl = parseInt(localStorage.getItem('htp_deadline_' + matchId) || '0', 10);
        return dl > 0 && daa > dl;
      } catch(e){ return false; }
    },
    clear: function(matchId) {
      try { localStorage.removeItem('htp_deadline_' + matchId); } catch(e){}
    }
  };
  console.log('[HTP Match Deadline v1.0] loaded');
})(window);
>>>>>>> d3fb362 (fix: add 4 missing JS modules, silence /deadline/daa 500 errors)
