/**
 * htp-autopayout-engine.js — SHIM v5.1
 *
 * All settlement + payout logic runs in Rust (autopayout.rs, settlement.rs, fee.rs).
 * This shim:
 *   1. Listens for game-over from the oracle / game engine
 *   2. Calls POST /autopayout/prepare (Rust) → resolves winner + covenant check + amounts
 *   3. Calls W.settleMatchPayout() → POST /escrow/payout (Rust) → builds + broadcasts TX
 *   4. Writes txId back to Firebase (idempotent lock prevents double-settle)
 *
 * Payout flow:
 *   game_over → /autopayout/prepare → winner_address + winner_payout_sompi + treasury_sompi
 *             → /escrow/payout      → raw TX (winner output 0, treasury output 1)
 *             → /tx/broadcast       → submitted to Kaspa TN12 node
 *             → Firebase relay/matchId/result.txId = txId  (settlement lock)
 */
;(function(W) {
  'use strict';

  function base() { return W.HTP_RUST_API || ''; }
  var LOG = function() { var a = Array.prototype.slice.call(arguments); console.log.apply(console, ['%c[HTP AutoPayout v5.1]', 'color:#49e8c2;font-weight:bold'].concat(a)); };
  var ERR = function() { var a = Array.prototype.slice.call(arguments); console.error.apply(console, ['[HTP AutoPayout v5.1]'].concat(a)); };

  function fdb() { return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null; }
  function myId() { return W.connectedAddress || W.htpAddress || W.walletAddress || 'unknown'; }

  async function rustPost(path, body) {
    if (!base()) throw new Error('HTP_RUST_API not configured — set window.HTP_RUST_API');
    var r = await fetch(base() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      var text = await r.text().catch(function() { return r.status; });
      throw new Error('Rust API ' + path + ' failed: ' + r.status + ' — ' + text);
    }
    return r.json();
  }

  // ── Main entry: called when game board detects game-over ─────────────────
  W.handleMatchGameOver = async function(reason, winnerRaw) {
    var match   = W.matchLobby && W.matchLobby.activeMatch;
    var matchId = (match && match.id) || W._htpCurrentMatchId;
    var game    = (match && (match.game || 'chess').toLowerCase()) || 'chess';
    var network = W.HTP_NETWORK_ID || 'testnet-12';

    if (!matchId) { ERR('No active matchId — cannot settle'); return; }

    // ── Settlement idempotency lock ──────────────────────────────────────
    if (fdb()) {
      var resultRef = fdb().ref('relay/' + matchId + '/result');
      var snap = await resultRef.once('value');
      if (snap.exists() && snap.val().txId) {
        LOG('already settled', snap.val().txId);
        return;
      }
      // Write result stub (prevents race condition between two clients)
      if (!snap.exists()) {
        await resultRef.set({
          winner: String(winnerRaw),
          reason: reason,
          ts:     Date.now(),
          by:     myId(),
        });
      }
    }

    // ── Retrieve local escrow (private key never leaves browser) ────────
    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow) { LOG('no local escrow — waiting for partner to settle'); return; }
    if (escrow.settled) { LOG('already settled locally', escrow.settleTxId); return; }
    if (!escrow.privateKey) { LOG('no local key — partner must settle'); return; }

    try {
      // ── Step 1: Resolve winner + covenant check + fee amounts ──────────
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
        redeem_script_hex: escrow.redeemScript || null,
        network:           network,
      });

      LOG('settlement prep OK —',
        prep.is_draw ? 'DRAW' : ('winner: ' + prep.winner_str),
        '→', prep.winner_address,
        '| payout:', prep.winner_payout_sompi, 'sompi',
        '| fee:', prep.protocol_fee_sompi, 'sompi → treasury:', prep.treasury_address
      );

      if (!prep.covenant_ok) {
        ERR('Covenant integrity check FAILED — aborting payout for match', matchId);
        if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ error: 'covenant_mismatch' });
        return;
      }

      // ── Step 2: Build + sign + broadcast payout TX ────────────────────
      var txId;
      if (prep.is_draw) {
        // Draw: cancel path — refund both players equally
        txId = await W.settleMatchDraw(matchId, prep.creator_address, prep.joiner_address);
      } else {
        // Win: settle path — winner gets payout, treasury gets fee
        txId = await W.settleMatchPayout(
          matchId,
          prep.winner_address,
          prep.is_draw,
          prep.creator_address,
          prep.joiner_address
        );
      }

      // ── Step 3: Write txId to Firebase (settlement lock complete) ──────
      if (txId) {
        if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ txId: txId, settledAt: Date.now() });
        if (W.markEscrowSettled) W.markEscrowSettled(matchId, txId);
        LOG('settlement TX broadcast:', txId);
      } else {
        ERR('settlement TX returned no txId');
      }

    } catch(e) {
      ERR('settlement failed for match', matchId, '—', e.message);
      if (fdb()) fdb().ref('relay/' + matchId + '/result').update({ error: e.message });
    }
  };

  // ── settleMatchPayout: escrow → winner + treasury ────────────────────────
  // Called by handleMatchGameOver. Also exposed for manual recovery.
  W.settleMatchPayout = async function(matchId, winnerAddress, isDraw, creatorAddr, joinerAddr) {
    var escrow  = W.getEscrow ? W.getEscrow(matchId) : null;
    var network = W.HTP_NETWORK_ID || 'testnet-12';
    if (!escrow) throw new Error('No escrow found for match ' + matchId);

    // Fetch UTXOs for the escrow address
    var utxoResp = await fetch(base() + '/wallet/balance/' + escrow.escrowAddress);
    var utxoData = await utxoResp.json();
    var utxos    = (utxoData && utxoData.utxos) || [];

    if (!utxos.length) throw new Error('No UTXOs found at escrow address ' + escrow.escrowAddress);

    // Get treasury address
    var feeResp     = await rustPost('/fee/treasury', { network: network });
    var treasuryAddr = feeResp.treasury_address;

    // Build payout TX via Rust
    var txResp = await rustPost('/escrow/payout', {
      escrow_address:   escrow.escrowAddress,
      winner_address:   winnerAddress,
      treasury_address: treasuryAddr,
      fee_bps:          200,  // 2%
      utxos:            utxos,
    });

    // Broadcast via Rust
    var broadcastResp = await rustPost('/tx/broadcast', { raw_tx: txResp.raw_tx });
    return broadcastResp.transaction_id || txResp.tx_id;
  };

  // ── settleMatchDraw: escrow → equal split to both players ────────────────
  W.settleMatchDraw = async function(matchId, creatorAddr, joinerAddr) {
    var escrow = W.getEscrow ? W.getEscrow(matchId) : null;
    if (!escrow) throw new Error('No escrow found for match ' + matchId);

    var utxoResp = await fetch(base() + '/wallet/balance/' + escrow.escrowAddress);
    var utxoData = await utxoResp.json();
    var utxos    = (utxoData && utxoData.utxos) || [];

    if (!utxos.length) throw new Error('No UTXOs found at escrow address ' + escrow.escrowAddress);

    var txResp = await rustPost('/escrow/cancel', {
      escrow_address:  escrow.escrowAddress,
      player_a_address: creatorAddr,
      player_b_address: joinerAddr,
      utxos:           utxos,
    });

    var broadcastResp = await rustPost('/tx/broadcast', { raw_tx: txResp.raw_tx });
    return broadcastResp.transaction_id || txResp.tx_id;
  };

  LOG('loaded — Rust backend:', base() || '(HTP_RUST_API not yet set)');
})(window);
