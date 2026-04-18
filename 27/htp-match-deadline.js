/* HTP Match Deadline v1.0 — timeout enforcement for active matches */
(function(){
  var _timers = {};
  window.HTPMatchDeadline = {
    set: function(matchId, daaDeadline, cb) {
      _timers[matchId] = { deadline: daaDeadline, callback: cb };
    },
    cancel: function(matchId) { delete _timers[matchId]; },
    check: function(matchId, currentDaa) {
      var t = _timers[matchId];
      if (t && currentDaa >= t.deadline) { t.callback(matchId); delete _timers[matchId]; }
    }
  };
  console.log('[HTP Match Deadline] loaded');
})();
