/**
 * htp-autopayout-engine.js — SHIM v5.0
 *
 * All settlement + payout logic has been ported to Rust (autopayout.rs, settlement.rs, fee.rs).
 * This shim:
 *   1. Detects game-over from Firebase oracle result
 *   2. Calls POST /autopayout/prepare (Rust) to resolve winner + amounts
 *   3. Calls W.settleMatchPayout() which calls POST /escrow/payout (Rust)
 *   4. Writes txId back to Firebase
 *
 * Game UI (chess board, connect4 grid, etc.) is NOT affected — those stay in
 * htp-autopayout-engine's original UI sections which are moved to their own files.
 */
;(function(W) {
  'use strict';

  var BASE = W.HTP_RUST_API || 'https://htp-backend-<YOUR_CLOUD_RUN_HASH>.run.app';
  var LOG  = function() { var a = Array.prototype.slice.call(arguments); console.log.apply(console, ['%c[HTP AutoPayout Shim v5.0]', 'color:#49e8c2;font-weight:bold'].concat(a)); };
  var ERR  = function() { var a = Array.prototype.slice.call(arguments); console.error.apply(console, ['[HTP AutoPayout Shim v5.0]'].concat(a)); };

  function fdb() { return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null; }
  function myId() { return W.connectedAddress || W.htpAddress || W.walletAddress || 'unknown'; }

  async function rustPost(path, body) {
    var r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Rust API ' + path + ' failed: ' + r.status);
    return r.json();
  }

  W.handleMatchGameOver = async function(reason, winnerRaw) {
    var match   = W.matchLobby && W.matchLobby.activeMatch;
    var matchId = match ? match.id : W._htpCurrentMatchId;
    var game    = match ? (match.game || 'chess').toLowerCase() : 'chess';

    // Firebase settlement lock (idempotent)
    if (matchId && fdb()) {
      var resultRef = fdb().ref('relay/' + matchId + '/result');
      var snap = await resultRef.once('value');
      if (snap.exists() && snap.val().txId) { LOG('already settled', snap.val().txId); return; }
      if (!snap.exists()) await resultRef.set({ winner: String(winnerRaw), reason: reason, ts: Date.now(), by: myId() });
    }

    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow || !escrow.privateKey || escrow.settled) { LOG('no local key — waiting for partner'); return; }

    try {
      var prep = await rustPost('/autopayout/prepare', {
        match_id: matchId, game: game, winner_raw: String(winnerRaw), reason: reason,
        stake_kas: escrow.stakeKas || 0,
        creator_address: match && match.creatorAddress, joiner_address: match && match.joinerAddress,
        redeem_script_hex: escrow.redeemScript, network: W.HTP_NETWORK_ID || 'testnet-12'
      });

      var txId = await W.settleMatchPayout(
        matchId, prep.winner_address, prep.is_draw,
        prep.creator_address, prep.joiner_address
      );

      if (txId && fdb()) fdb().ref('relay/' + matchId + '/result').update({ txId: txId });
      LOG('settlement TX', txId);
    } catch(e) {
      ERR('settlement failed', e.message);
    }
  };

  LOG('loaded — Rust backend:', BASE);
})(window);
