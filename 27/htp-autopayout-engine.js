/**
 * htp-autopayout-engine.js — SHIM v5.2
 *
 * All settlement + payout logic runs in Rust (autopayout.rs, settlement.rs, fee.rs).
 *
 * Payout flow (fully signed + broadcast):
 *   game_over
 *     → POST /autopayout/prepare  — resolve winner + covenant check + fee amounts
 *     → POST /wallet/balance/:addr — fetch escrow UTXOs
 *     → POST /fee/treasury         — get current treasury address
 *     → POST /escrow/payout        — build + Schnorr-sign TX (signing_key_hex passed)
 *     → POST /tx/broadcast         — submit to Kaspa node
 *     → Firebase relay/matchId/result.txId = txId  (settlement lock)
 *
 * Draw flow:
 *   → POST /escrow/cancel (OP_IF branch, creator key)
 *   → POST /tx/broadcast
 */
;(function(W) {
  'use strict';

  function base() { return W.HTP_RUST_API || ''; }
  var LOG = function() { var a = Array.prototype.slice.call(arguments); console.log.apply(console, ['%c[HTP AutoPayout v5.2]', 'color:#49e8c2;font-weight:bold'].concat(a)); };
  var ERR = function() { var a = Array.prototype.slice.call(arguments); console.error.apply(console, ['[HTP AutoPayout v5.2]'].concat(a)); };

  function fdb() { return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null; }
  function myId() { return W.connectedAddress || W.htpAddress || W.walletAddress || 'unknown'; }

  async function rustPost(path, body) {
    if (!base()) throw new Error('HTP_RUST_API not configured');
    var r = await fetch(base() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      var text = await r.text().catch(function() { return String(r.status); });
      throw new Error('Rust API ' + path + ' → ' + r.status + ': ' + text);
    }
    return r.json();
  }

  async function fetchUTXOs(escrowAddress) {
    if (!base()) throw new Error('HTP_RUST_API not configured');
    var r = await fetch(base() + '/wallet/balance/' + escrowAddress);
    if (!r.ok) throw new Error('Failed to fetch UTXOs for ' + escrowAddress + ': ' + r.status);
    var d = await r.json();
    return (d && d.utxos) || [];
  }

  // ── Main entry: called by game board when match ends ───────────────────
  W.handleMatchGameOver = async function(reason, winnerRaw) {
    var match   = W.matchLobby && W.matchLobby.activeMatch;
    var matchId = (match && match.id) || W._htpCurrentMatchId;
    var game    = (match && (match.game || 'chess').toLowerCase()) || 'chess';
    var network = W.HTP_NETWORK_ID || 'testnet-12';

    if (!matchId) { ERR('No active matchId'); return; }

    // Settlement idempotency lock
    if (fdb()) {
      var resultRef = fdb().ref('relay/' + matchId + '/result');
      var snap = await resultRef.once('value');
      if (snap.exists() && snap.val().txId) { LOG('already settled', snap.val().txId); return; }
      if (!snap.exists()) {
        await resultRef.set({ winner: String(winnerRaw), reason: reason, ts: Date.now(), by: myId() });
      }
    }

    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow)            { LOG('no local escrow — partner will settle'); return; }
    if (escrow.settled)     { LOG('already settled locally', escrow.settleTxId); return; }
    if (!escrow.privateKey) { LOG('no local key — partner must settle'); return; }

    try {
      // Step 1: Resolve winner + covenant check + fee amounts
      var prep = await rustPost('/autopayout/prepare', {
        match_id:          matchId,
        game:              game,
        winner_raw:        String(winnerRaw),
        reason:            reason,
        stake_kas:         escrow.stakeKas || 0,
        creator_address:   match && match.creatorAddress,
        joiner_address:    match && match.joinerAddress,
        creator_player_id: match && match.creatorPlayerId,
        joiner_player_id:  match && match.joinerPlayerId,
        redeem_script_hex: escrow.redeemScriptHex || null,
        network:           network,
      });

      LOG(
        prep.is_draw ? 'DRAW' : ('winner: ' + prep.winner_str + ' → ' + prep.winner_address),
        '| payout:', prep.winner_payout_sompi, 'sompi',
        '| fee:', prep.protocol_fee_sompi, 'sompi → treasury:', prep.treasury_address
      );

      if (!prep.covenant_ok) {
        ERR('Covenant integrity check FAILED — aborting payout', matchId);
        if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ error: 'covenant_mismatch' });
        return;
      }

      // Step 2: Fetch UTXOs
      var utxos = await fetchUTXOs(escrow.escrowAddress);
      if (!utxos.length) throw new Error('No UTXOs at escrow ' + escrow.escrowAddress);

      // Step 3: Build + sign TX
      var txResp;
      if (prep.is_draw) {
        txResp = await rustPost('/escrow/cancel', {
          escrow_address:    escrow.escrowAddress,
          player_a_address:  prep.creator_address,
          player_b_address:  prep.joiner_address,
          utxos:             utxos,
          signing_key_hex:   escrow.privateKey,
          redeem_script_hex: escrow.redeemScriptHex,
        });
      } else {
        txResp = await rustPost('/escrow/payout', {
          escrow_address:    escrow.escrowAddress,
          winner_address:    prep.winner_address,
          treasury_address:  prep.treasury_address,
          fee_bps:           200,
          utxos:             utxos,
          signing_key_hex:   escrow.privateKey,
          redeem_script_hex: escrow.redeemScriptHex,
        });
      }

      if (!txResp.signed) {
        ERR('TX was built but NOT signed — privateKey or redeemScriptHex missing in escrow entry');
        return;
      }

      // Step 4: Broadcast
      var broadcastResp = await rustPost('/tx/broadcast', { raw_tx: txResp.raw_tx });
      var txId = broadcastResp.tx_id || txResp.tx_id;

      // Step 5: Lock settlement in Firebase
      if (txId) {
        if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ txId: txId, settledAt: Date.now() });
        if (W.markEscrowSettled) W.markEscrowSettled(matchId, txId);
        LOG('settlement TX broadcast:', txId);
        window.dispatchEvent(new CustomEvent('htp:match:settled', { detail: { matchId: matchId, txId: txId, draw: prep.is_draw } }));
      } else {
        ERR('broadcast returned no txId');
      }

    } catch(e) {
      ERR('settlement failed for match', matchId, '—', e.message);
      if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ error: e.message });
    }
  };

  // settleMatchPayout / settleMatchDraw kept for manual recovery calls
  W.settleMatchPayout = async function(matchId, winnerAddress, isDraw, creatorAddr, joinerAddr) {
    var escrow  = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow) throw new Error('No escrow for match ' + matchId);
    var utxos   = await fetchUTXOs(escrow.escrowAddress);
    var feeResp = await rustPost('/fee/treasury', { network: W.HTP_NETWORK_ID || 'testnet-12' });
    var txResp  = await rustPost('/escrow/payout', {
      escrow_address:    escrow.escrowAddress,
      winner_address:    winnerAddress,
      treasury_address:  feeResp.treasury_address,
      fee_bps:           200,
      utxos:             utxos,
      signing_key_hex:   escrow.privateKey,
      redeem_script_hex: escrow.redeemScriptHex,
    });
    var bcast = await rustPost('/tx/broadcast', { raw_tx: txResp.raw_tx });
    return bcast.tx_id || txResp.tx_id;
  };

  W.settleMatchDraw = async function(matchId, creatorAddr, joinerAddr) {
    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow) throw new Error('No escrow for match ' + matchId);
    var utxos  = await fetchUTXOs(escrow.escrowAddress);
    var txResp = await rustPost('/escrow/cancel', {
      escrow_address:    escrow.escrowAddress,
      player_a_address:  creatorAddr,
      player_b_address:  joinerAddr,
      utxos:             utxos,
      signing_key_hex:   escrow.privateKey,
      redeem_script_hex: escrow.redeemScriptHex,
    });
    var bcast = await rustPost('/tx/broadcast', { raw_tx: txResp.raw_tx });
    return bcast.tx_id || txResp.tx_id;
  };

  LOG('loaded — Rust backend:', base() || '(HTP_RUST_API pending)');
})(window);
