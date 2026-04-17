/**
 * htp-autopayout-engine.js — v6.0
 *
 * Payout flow:
 *   handleMatchGameOver(reason, winner)
 *     → idempotency check (Firebase relay/<matchId>/result.txId)
 *     → POST /autopayout/prepare
 *     → GET  /wallet/balance/<escrowAddress>
 *     → POST /escrow/payout  (or /escrow/cancel for draw)
 *     → POST /tx/broadcast   — 3 retries, 2s backoff
 *     → Firebase relay/<matchId>/result.txId = txId
 *     → CustomEvent htp:settlement:complete
 *
 * No test mnemonics. Rust API base = window.HTP_RUST_API (set by htp-init.js).
 */
;(function(W) {
  'use strict';

  var VERSION = 'v6.0';
  var RETRY_COUNT = 3;
  var RETRY_DELAY_MS = 2000;
  var BROADCAST_TIMEOUT_MS = 30000;

  function base() { return W.HTP_RUST_API || ''; }
  function LOG()  { var a = Array.prototype.slice.call(arguments); console.log.apply(console,  ['%c[HTP AutoPayout ' + VERSION + ']', 'color:#49e8c2;font-weight:bold'].concat(a)); }
  function ERR()  { var a = Array.prototype.slice.call(arguments); console.error.apply(console, ['[HTP AutoPayout ' + VERSION + ']'].concat(a)); }

  function fdb() { return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null; }
  function myId() { return W.connectedAddress || W.htpAddress || W.walletAddress || 'unknown'; }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  // Health check before any payout attempt
  async function checkHealth() {
    if (!base()) throw new Error('HTP_RUST_API not configured');
    try {
      var r = await fetch(base() + '/health', { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error('health status ' + r.status);
      LOG('backend healthy ✓');
    } catch(e) {
      throw new Error('Backend health check failed: ' + e.message);
    }
  }

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

  async function broadcastWithRetry(rawTx) {
    var lastErr;
    for (var i = 0; i < RETRY_COUNT; i++) {
      try {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, BROADCAST_TIMEOUT_MS);
        var r = await fetch(base() + '/tx/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_tx: rawTx }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!r.ok) {
          var t = await r.text().catch(function() { return String(r.status); });
          throw new Error('/tx/broadcast → ' + r.status + ': ' + t);
        }
        return await r.json();
      } catch(e) {
        lastErr = e;
        ERR('broadcast attempt ' + (i+1) + ' failed:', e.message);
        if (i < RETRY_COUNT - 1) await sleep(RETRY_DELAY_MS);
      }
    }
    throw lastErr;
  }

  // ── Main entry ──────────────────────────────────────────────────────────
  W.handleMatchGameOver = async function(reason, winnerRaw) {
    var match   = W.matchLobby && W.matchLobby.activeMatch;
    var matchId = (match && match.id) || W._htpCurrentMatchId;
    var game    = (match && (match.game || 'chess').toLowerCase()) || 'chess';
    var network = W.HTP_NETWORK_ID || 'testnet-12';

    if (!matchId) { ERR('No active matchId'); return; }
    LOG('game over — matchId:', matchId, 'reason:', reason, 'winner:', winnerRaw);

    // Idempotency — check BEFORE doing anything
    if (fdb()) {
      var resultRef = fdb().ref('relay/' + matchId + '/result');
      var snap = await resultRef.once('value');
      if (snap.exists() && snap.val().txId) {
        LOG('already settled', snap.val().txId);
        W.dispatchEvent(new CustomEvent('htp:settlement:complete', { detail: { matchId: matchId, txId: snap.val().txId, winner: winnerRaw, alreadySettled: true } }));
        return;
      }
      if (!snap.exists()) {
        await resultRef.set({ winner: String(winnerRaw), reason: reason, ts: Date.now(), by: myId() });
      }
    }

    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow)            { LOG('no local escrow — partner will settle'); return; }
    if (escrow.settled)     { LOG('already settled locally', escrow.settleTxId); return; }
    if (!escrow.privateKey) { LOG('no local key — partner must settle'); return; }

    try {
      // Health check
      await checkHealth();

      // Step 1: Resolve winner + covenant check
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
        '| fee:', prep.protocol_fee_sompi, 'sompi'
      );

      if (!prep.covenant_ok) {
        ERR('Covenant integrity check FAILED — aborting', matchId);
        if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ error: 'covenant_mismatch' });
        return;
      }

      // Step 2: UTXOs
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
        ERR('TX built but NOT signed — privateKey or redeemScriptHex missing');
        return;
      }

      // Step 4: Broadcast with retry
      var broadcastResp = await broadcastWithRetry(txResp.raw_tx);
      var txId = broadcastResp.tx_id || txResp.tx_id;

      if (!txId) throw new Error('broadcast returned no txId after ' + RETRY_COUNT + ' attempts');

      // Step 5: Lock settlement — idempotency check AFTER TX build
      if (fdb()) {
        var afterSnap = await fdb().ref('relay/' + matchId + '/result/txId').once('value');
        if (afterSnap.exists()) {
          LOG('race: txId already written by partner', afterSnap.val());
        } else {
          await fdb().ref('relay/' + matchId + '/result').update({ txId: txId, settledAt: Date.now() });
        }
      }

      if (W.markEscrowSettled) W.markEscrowSettled(matchId, txId);
      LOG('settlement TX broadcast:', txId);

      W.dispatchEvent(new CustomEvent('htp:settlement:complete', {
        detail: {
          matchId:   matchId,
          txId:      txId,
          winner:    prep.winner_address,
          stakeKas:  escrow.stakeKas || 0,
          isDraw:    prep.is_draw,
          payout:    prep.winner_payout_sompi,
          fee:       prep.protocol_fee_sompi,
          treasury:  prep.treasury_address,
        }
      }));

    } catch(e) {
      ERR('settlement failed for match', matchId, '—', e.message);
      if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ error: e.message, disputedAt: Date.now() });
      W.dispatchEvent(new CustomEvent('htp:settlement:failed', { detail: { matchId: matchId, error: e.message } }));
    }
  };

  // Manual recovery helpers
  W.settleMatchPayout = async function(matchId, winnerAddress) {
    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow) throw new Error('No escrow for match ' + matchId);
    var utxos  = await fetchUTXOs(escrow.escrowAddress);
    var feeRes = await rustPost('/fee/treasury', { network: W.HTP_NETWORK_ID || 'testnet-12' });
    var txResp = await rustPost('/escrow/payout', {
      escrow_address:    escrow.escrowAddress,
      winner_address:    winnerAddress,
      treasury_address:  feeRes.treasury_address,
      fee_bps:           200,
      utxos:             utxos,
      signing_key_hex:   escrow.privateKey,
      redeem_script_hex: escrow.redeemScriptHex,
    });
    var bcast = await broadcastWithRetry(txResp.raw_tx);
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
    var bcast = await broadcastWithRetry(txResp.raw_tx);
    return bcast.tx_id || txResp.tx_id;
  };

  LOG('loaded — Rust backend:', base() || '(HTP_RUST_API pending)');
})(window);
