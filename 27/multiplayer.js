// multiplayer.js — Firebase Realtime relay for HTP skill games
(function(){
  var db = null;
  function getDb(){
    if(db) return db;
    if(window.htpFirebaseDb) { db = window.htpFirebaseDb; return db; }
    if(typeof firebase !== 'undefined' && firebase.database) { db = firebase.database(); return db; }
    return null;
  }

  window.htpMultiplayer = {
    createMatch: function(matchId, data){
      var d = getDb(); if(!d) return Promise.reject('No Firebase DB');
      return d.ref('matches/' + matchId).set(data);
    },
    joinMatch: function(matchId, playerAddr){
      var d = getDb(); if(!d) return Promise.reject('No Firebase DB');
      return d.ref('matches/' + matchId + '/player2').set(playerAddr);
    },
    sendMove: function(matchId, move){
      var d = getDb(); if(!d) return Promise.reject('No Firebase DB');
      return d.ref('matches/' + matchId + '/moves').push(move);
    },
    onMove: function(matchId, cb){
      var d = getDb(); if(!d) return;
      d.ref('matches/' + matchId + '/moves').on('child_added', function(snap){ cb(snap.val()); });
    },
    onMatchUpdate: function(matchId, cb){
      var d = getDb(); if(!d) return;
      d.ref('matches/' + matchId).on('value', function(snap){ cb(snap.val()); });
    },
    updateMatch: function(matchId, data){
      var d = getDb(); if(!d) return Promise.reject('No Firebase DB');
      return d.ref('matches/' + matchId).update(data);
    },
    listMatches: function(cb){
      var d = getDb(); if(!d) return;
      d.ref('matches').orderByChild('status').equalTo('waiting').on('value', function(snap){ cb(snap.val() || {}); });
    },
    cleanup: function(matchId){
      var d = getDb(); if(!d) return;
      d.ref('matches/' + matchId + '/moves').off();
      d.ref('matches/' + matchId).off();
    }
  };

  console.log('HTP Multiplayer: Firebase relay loaded');
})();
