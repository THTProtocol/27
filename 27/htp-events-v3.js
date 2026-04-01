// =============================================================================
// htp-events-v3.js — HTP Skill Games v3
// Clean createMatchWithLobby + joinLobbyMatch using covenant escrow v2
// Fixes: sgEsc read, correct sompi, proper escrow + settlement flow
// =============================================================================
(function () {
  'use strict';

  function kasToSompi(kas) {
    var n = parseFloat(kas); if(isNaN(n)||n<=0) return 0;
    return Math.round(n * 1e8);
  }
  function getVal(id, fb) { var el=document.getElementById(id); return el?(el.value||fb):fb; }
  function getAddr()      { return window.walletAddress||window.htpAddress||window.htpConnectedAddress||null; }
  function getBalSompi()  { if(window.walletBalance&&window.walletBalance.total) return Number(window.walletBalance.total); if(window.htpBalanceSompi) return Number(window.htpBalanceSompi); return 0; }

  // ── CREATE MATCH ─────────────────────────────────────────────────────────────
  async function createMatchWithLobby() {
    var addr = getAddr();
    if (!addr) { if(window.showToast)window.showToast('Connect wallet first','error'); if(window.goWallet)window.goWallet(); return; }

    // Read form — HTML uses sgGame, sgEsc, sgTime, sgSeries
    var game      = getVal('sgGame','chess');
    var stakeKas  = parseFloat(getVal('sgEsc','5'))||5;
    var timeCtrl  = getVal('sgTime','5+0');
    var seriesLen = parseInt(getVal('sgSeries','1'))||1;
    var stakeSompi = kasToSompi(stakeKas);

    if (getBalSompi() < stakeSompi + 10000) { if(window.showToast)window.showToast('Insufficient balance. Need '+stakeKas+' KAS','error'); return; }
    if (!confirm('Create '+game+' match for '+stakeKas+' KAS?\nTime: '+timeCtrl+' | Series: Bo'+seriesLen)) return;

    var matchId = 'HTP-'+Date.now().toString(36).toUpperCase();
    try {
      if(window.showToast) window.showToast('Generating covenant escrow...','info');
      if (typeof window.generateMatchEscrow !== 'function') throw new Error('htp-covenant-escrow-v2.js not loaded');
      var escrow = await window.generateMatchEscrow(matchId, addr);
      if (!escrow||!escrow.address) throw new Error('Escrow generation failed');

      console.log('[HTP v3] Escrow:',escrow.address,'| Script:',escrow.redeemScript?escrow.redeemScript.substring(0,40)+'...':'P2PK fallback');
      if(window.showToast) window.showToast('Sending '+stakeKas+' KAS to escrow...','info');

      var meta = {type:'create',game:game,stake:String(stakeKas),timeControl:timeCtrl,matchId:matchId,creator:addr};
      var payloadHex = Array.from(new TextEncoder().encode(JSON.stringify(meta))).map(function(b){return b.toString(16).padStart(2,'0');}).join('');

      // Call htpSendTx with explicit sompi (integer, no re-conversion needed)
      var txId = await window.htpSendTx(escrow.address, stakeSompi, {priorityFee:0,payload:payloadHex,matchId:matchId,amount:stakeSompi});
      if (!txId) throw new Error('Stake TX returned no txId');
      console.log('[HTP v3] Stake TX:',txId);

      var match = {
        id:matchId, game:game, timeControl:timeCtrl, stake:stakeKas, stakeKas:stakeKas,
        stakeSompi:String(stakeSompi), seriesLen:seriesLen,
        creator:window.matchLobby?window.matchLobby.myPlayerId:'P1',
        creatorAddrFull:addr, opponent:null, status:'waiting',
        created:Date.now(), escrowAddress:escrow.address, escrowTxId:txId,
        covenant:true, redeemScript:escrow.redeemScript
      };
      escrow.escrowTxId = txId;

      if(window.matchLobby&&window.matchLobby.matches) window.matchLobby.matches.push(match);

      try {
        if(window.firebase&&window.firebase.database) {
          var db=window.firebase.database();
          await db.ref('matches/'+matchId+'/info').set(match);
          await db.ref('matches/'+matchId+'/players').set({creator:addr,creatorAddrFull:addr,opponent:null});
          await db.ref('lobby/'+matchId).set({id:matchId,game:game,stake:stakeKas,timeControl:timeCtrl,seriesLen:seriesLen,creator:match.creator,creatorAddrFull:addr,escrowAddress:escrow.address,status:'waiting',created:Date.now()});
        }
      } catch(e) { console.warn('[HTP v3] Firebase write non-fatal:',e.message); }

      if(typeof window.saveLobby==='function') window.saveLobby();
      if(typeof window.renderLobby==='function') window.renderLobby();
      if(typeof window.refreshBalanceFromChain==='function') setTimeout(window.refreshBalanceFromChain,3000);
      if(window.showToast) window.showToast('Match created! '+stakeKas+' KAS locked in covenant escrow.','success');
      console.log('[HTP v3] Match created:',matchId,'| Escrow:',escrow.address);
    } catch(e) {
      console.error('[HTP v3] createMatchWithLobby error:',e);
      if(window.showToast) window.showToast('Match creation failed: '+e.message,'error');
    }
  }

  // ── JOIN MATCH ────────────────────────────────────────────────────────────────
  async function joinLobbyMatch(matchId) {
    var addr = getAddr();
    if (!addr) { if(window.showToast)window.showToast('Connect wallet first','error'); return; }

    var m = null;
    if(window.matchLobby&&window.matchLobby.matches) m=window.matchLobby.matches.find(function(x){return x.id===matchId;});
    if (!m&&window.firebase&&window.firebase.database) {
      try { var s=await window.firebase.database().ref('lobby/'+matchId).once('value'); if(s.exists()) m=s.val(); } catch(e){}
    }
    if (!m||m.status!=='waiting') { if(window.showToast)window.showToast('Match no longer available','error'); return; }
    if (m.creatorAddrFull===addr) { if(window.showToast)window.showToast('Cannot join your own match','error'); return; }
    if (!m.escrowAddress) { if(window.showToast)window.showToast('No escrow address for this match','error'); return; }

    var stakeKas = parseFloat(m.stake||m.stakeKas||5)||5;
    var stakeSompi = kasToSompi(stakeKas);
    if (getBalSompi() < stakeSompi+10000) { if(window.showToast)window.showToast('Insufficient balance. Need '+stakeKas+' KAS','error'); return; }
    if (!confirm('Join '+m.game+' match for '+stakeKas+' KAS?')) return;

    try {
      if(window.showToast) window.showToast('Locking '+stakeKas+' KAS in escrow...','info');
      var meta={type:'join',game:m.game,stake:String(stakeKas),matchId:matchId,joiner:addr};
      var payloadHex=Array.from(new TextEncoder().encode(JSON.stringify(meta))).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var txId = await window.htpSendTx(m.escrowAddress, stakeSompi, {priorityFee:0,payload:payloadHex,matchId:matchId,amount:stakeSompi});
      if (!txId) throw new Error('Join TX returned no txId');
      console.log('[HTP v3] Join TX:',txId);

      m.opponent = window.matchLobby?window.matchLobby.myPlayerId:'P2';
      m.opponentAddrFull = addr; m.status='active'; m.joinTxId=txId;
      try {
        if(window.firebase&&window.firebase.database) {
          var db2=window.firebase.database();
          await db2.ref('matches/'+matchId+'/info/status').set('active');
          await db2.ref('matches/'+matchId+'/players/opponentAddrFull').set(addr);
          await db2.ref('lobby/'+matchId+'/status').set('active');
        }
      } catch(e){ console.warn('[HTP v3] Firebase join update:',e.message); }

      if(typeof window.saveLobby==='function') window.saveLobby();
      if(typeof window.renderLobby==='function') window.renderLobby();
      if(window.showToast) window.showToast('Matched! Launching game...','success');
      setTimeout(function(){
        if(typeof window.playMatch==='function') window.playMatch(matchId);
        else if(typeof window.previewMatch==='function') window.previewMatch(matchId);
      },800);
    } catch(e) {
      console.error('[HTP v3] joinLobbyMatch error:',e);
      if(window.showToast) window.showToast('Join failed: '+e.message,'error');
    }
  }

  // ── GAME OVER → SETTLE ───────────────────────────────────────────────────────
  async function handleMatchGameOver(reason, winnerColor) {
    var match = window.matchLobby&&window.matchLobby.activeMatch; if(!match) return;
    var iAmCreator = match.creator===(window.matchLobby&&window.matchLobby.myPlayerId);
    var seed=0; var idStr=(match.id||'').replace('HTP-',''); for(var i=0;i<idStr.length;i++) seed+=idStr.charCodeAt(i);
    var creatorFirst = seed%2===0;
    var creatorColor  = match.game==='chess'?(creatorFirst?'w':'b'):(creatorFirst?1:2);
    var opponentColor = match.game==='chess'?(creatorFirst?'b':'w'):(creatorFirst?2:1);
    var iWon = reason==='resign' ? true : (winnerColor===(iAmCreator?creatorColor:opponentColor));
    var stake = parseFloat(match.stake||5);
    var totalPot = stake*2;

    if (iWon) {
      if(typeof window.showGameOverOverlay==='function') window.showGameOverOverlay('YOU WIN!','+'+totalPot.toFixed(2)+' KAS','#49e8c2',match);
      if(window.showToast) window.showToast('Victory! Processing '+totalPot.toFixed(2)+' KAS payout...','success');
      try {
        var txId = await window.settleMatchPayout(match.id, getAddr(), false, null, null);
        if(txId&&typeof window.addToHistory==='function') window.addToHistory({type:'matchwin',amount:totalPot,game:match.game,matchId:match.id,txId:txId,timestamp:Date.now()});
      } catch(e){ console.error('[HTP v3] Payout failed:',e); }
    } else {
      if(typeof window.showGameOverOverlay==='function') window.showGameOverOverlay('YOU LOSE','-'+stake.toFixed(2)+' KAS','#ef4444',match);
    }
    match.status='finished'; match.result=iWon?'win':'loss'; match.finishedAt=Date.now();
    if(typeof window.saveLobby==='function') window.saveLobby();
    try {
      if(window.firebase&&window.firebase.database){
        window.firebase.database().ref('lobby/'+match.id+'/status').set('finished');
        window.firebase.database().ref('relay/'+match.id+'/result').set({winner:iWon?(window.matchLobby&&window.matchLobby.myPlayerId):'opponent',reason:reason,ts:Date.now()});
      }
    } catch(e){}
    if(typeof window.renderLobby==='function') window.renderLobby();
    if(typeof window.refreshBalanceFromChain==='function') setTimeout(window.refreshBalanceFromChain,3000);
  }

  // ── CANCEL ────────────────────────────────────────────────────────────────────
  async function cancelLobbyMatch(matchId) {
    try {
      var addr=getAddr();
      var db=window.firebase&&window.firebase.database&&window.firebase.database();
      if(db){
        var snap=await db.ref('lobby/'+matchId).once('value');
        var m=snap.exists()?snap.val():null;
        if(m&&m.creatorAddrFull&&m.creatorAddrFull!==addr){if(window.showToast)window.showToast('Only creator can cancel','error');return;}
        if(m&&m.status!=='waiting'){if(window.showToast)window.showToast('Match already started','error');return;}
      }
      if(typeof window.cancelMatchEscrow==='function') await window.cancelMatchEscrow(matchId);
      if(db){ await db.ref('lobby/'+matchId).remove(); await db.ref('matches/'+matchId+'/info/status').set('cancelled'); }
      if(window.htpMatches) delete window.htpMatches[matchId];
      if(window.showToast) window.showToast('Match cancelled','success');
      if(typeof window.renderLobby==='function') window.renderLobby();
    } catch(e){ console.error('[HTP v3] Cancel error:',e); if(window.showToast)window.showToast('Cancel failed: '+e.message,'error'); }
  }

  window.createMatchWithLobby = createMatchWithLobby;
  window.joinLobbyMatch       = joinLobbyMatch;
  window.handleMatchGameOver  = handleMatchGameOver;
  window.cancelLobbyMatch     = cancelLobbyMatch;
  console.log('[HTP Skill Games v3] Loaded — createMatchWithLobby, joinLobbyMatch, covenant settlement');
})();
