/**
 * htp-covenant-escrow-v2.js — SHIM v4.2
 *
 * Proxies all escrow operations to Rust backend (escrow.rs).
 * Private keys stay in the browser (localStorage) — never sent to backend
 * except at the moment of signing a settlement or cancel TX.
 *
 * Escrow TX structure enforced by Rust (KIP-10 covenant):
 *   Payout  → Output 0: winner_payout → winner_address
 *             Output 1: protocol_fee  → treasury_address
 *   Cancel  → Output 0: half stake    → creator_address
 *             Output 1: half stake    → joiner_address
 */
(function(W) {
  'use strict';

  function base() { return W.HTP_RUST_API || ''; }

  async function post(path, body) {
    if (!base()) throw new Error('[HTP Escrow] HTP_RUST_API not set — check htp-init.js');
    var r = await fetch(base() + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    if (!r.ok) {
      var text = await r.text().catch(function() { return r.status; });
      throw new Error('[HTP Escrow] ' + path + ' failed: ' + r.status + ' — ' + text);
    }
    return r.json();
  }

  // ── Escrow creation ─────────────────────────────────────────────────────
  // Creates a KIP-10 P2SH covenant escrow address.
  // Returns { escrow_address, script_hash, redeem_script_hex }.
  // MUST store redeem_script_hex in the escrow entry — needed for signing.
  W.htpEscrowCreateAddress = function(pubkeyA, pubkeyB, network) {
    return post('/escrow/create', {
      pubkey_a: pubkeyA,
      pubkey_b: pubkeyB,
      network:  network || W.HTP_NETWORK_ID || 'testnet-12',
    });
  };

  // ── Payout TX ────────────────────────────────────────────────────────────
  // Builds + signs a settlement TX.
  // req.signing_key_hex  — escrow private key (hex) from localStorage
  // req.redeem_script_hex — stored at escrow creation time
  // Returns { raw_tx, tx_id, signed: true } — ready to pass to /tx/broadcast.
  W.htpEscrowBuildPayout = function(req) {
    return post('/escrow/payout', req);
  };

  // ── Cancel TX ────────────────────────────────────────────────────────────
  // Builds + signs a cancel/refund TX (OP_IF branch).
  // req.signing_key_hex  — creator private key (hex) from localStorage
  // req.redeem_script_hex — stored at escrow creation time
  W.htpEscrowBuildCancel = function(req) {
    return post('/escrow/cancel', req);
  };

  // ── Settlement preview ───────────────────────────────────────────────────
  W.htpSettlementPreview = function(stakeKas, isDraw, network) {
    return post('/settlement/preview', {
      stake_kas: stakeKas,
      is_draw:   isDraw || false,
      network:   network || W.HTP_NETWORK_ID || 'testnet-12',
    });
  };

  // ── Covenant integrity check ─────────────────────────────────────────────
  W.htpValidateCovenant = function(redeemScriptHex, network) {
    return post('/settlement/validate-covenant', {
      redeem_script_hex: redeemScriptHex,
      network: network || W.HTP_NETWORK_ID || 'testnet-12',
    });
  };

  // ── Local escrow store (private key never leaves browser) ───────────────
  var STORE_KEY = 'htp-covenant-escrows';

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function writeStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch(e) {}
  }

  // Escrow entry shape:
  // {
  //   matchId, escrowAddress, redeemScriptHex,
  //   privateKey (hex — kept only in localStorage),
  //   stakeKas, settled, settleTxId, settledAt
  // }
  W.getEscrow = function(matchId) {
    return readStore()[matchId] || null;
  };

  W.saveEscrow = function(entry) {
    if (!entry || !entry.matchId) { console.warn('[HTP Escrow] saveEscrow: entry.matchId missing'); return; }
    var s = readStore();
    s[entry.matchId] = entry;
    writeStore(s);
    W.htpLastEscrow = entry;
  };

  W.markEscrowSettled = function(matchId, txId) {
    var s = readStore();
    if (s[matchId]) {
      s[matchId].settled    = true;
      s[matchId].settleTxId = txId;
      s[matchId].settledAt  = Date.now();
      writeStore(s);
    }
  };

  W.clearEscrow = function(matchId) {
    var s = readStore();
    delete s[matchId];
    writeStore(s);
  };

  // ── cancelMatchEscrow ────────────────────────────────────────────────────
  // Called by HTPCancelFlow when creator cancels a pending game.
  // Builds, signs, and broadcasts the cancel TX in one call.
  W.cancelMatchEscrow = async function(matchId) {
    var escrow = W.getEscrow(matchId);
    if (!escrow) throw new Error('No escrow found for match ' + matchId);
    if (escrow.settled) throw new Error('Match ' + matchId + ' already settled');

    // Fetch UTXOs
    var utxoResp = await fetch(base() + '/wallet/balance/' + escrow.escrowAddress);
    if (!utxoResp.ok) throw new Error('Failed to fetch UTXOs for ' + escrow.escrowAddress);
    var utxoData = await utxoResp.json();
    var utxos    = (utxoData && utxoData.utxos) || [];
    if (!utxos.length) throw new Error('No UTXOs at escrow ' + escrow.escrowAddress);

    // Build + sign cancel TX
    var txResp = await W.htpEscrowBuildCancel({
      escrow_address:    escrow.escrowAddress,
      player_a_address:  escrow.creatorAddress,
      player_b_address:  escrow.joinerAddress || escrow.creatorAddress,
      utxos:             utxos,
      signing_key_hex:   escrow.privateKey,
      redeem_script_hex: escrow.redeemScriptHex,
    });

    if (!txResp.signed) throw new Error('TX not signed — privateKey or redeemScriptHex missing in escrow entry');

    // Broadcast
    var broadcastResp = await post('/tx/broadcast', { raw_tx: txResp.raw_tx });
    var txId = broadcastResp.tx_id;
    W.markEscrowSettled(matchId, txId);
    return txId;
  };

  console.log('[HTP Escrow Shim v4.2] proxying to', base() || '(HTP_RUST_API pending)');
})(window);
