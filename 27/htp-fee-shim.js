/**
 * htp-fee-shim.js — window.HTPFee proxy to Rust /fee/* endpoints — v2.0
 *
 * FIX: Draw fee math corrected.
 *   fee = stakeKas * 0.01  (1% of one player's stake)
 *   NOT stakeKas * 2 * 0.01
 *
 * Added: HTPFee.drawSettle(stakeKas)
 */
(function(W) {
  'use strict';

  function base() {
    return W.HTP_RUST_API || '';
  }

  async function post(path, body) {
    var url = base() + path;
    if (!base()) throw new Error('[HTPFee] HTP_RUST_API not set');
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('[HTPFee] ' + path + ' → ' + r.status);
    return r.json();
  }

  // ── Fee constants (mirrors fee.rs) ───────────────────────────────────────
  var SKILL_WIN_PCT          = 0.02;
  var EVENT_WIN_PCT          = 0.02;
  var MAXIMIZER_POOL_SPLIT   = 0.50;
  var MAXIMIZER_HEDGE_LOSS   = 0.30;
  var TREASURY_TN12          = 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
  var TREASURY_MAINNET       = 'kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel';

  function net() { return W.HTP_NETWORK_ID || 'testnet-12'; }
  function treasury() { return net().indexOf('main') !== -1 ? TREASURY_MAINNET : TREASURY_TN12; }

  // ── Sync implementations ─────────────────────────────────────────────────

  function skillGameSettle(stakeKas) {
    var totalPool    = stakeKas * 2;
    var protocolFee  = totalPool * SKILL_WIN_PCT;
    var winnerPayout = totalPool - protocolFee;
    return {
      totalPool:       totalPool,
      protocolFee:     protocolFee,
      winnerPayout:    winnerPayout,
      feeBreakdown:    '2% of ' + totalPool.toFixed(4) + ' KAS pool',
      treasuryAddress: treasury(),
    };
  }

  // FIXED: fee = stakeKas * 0.01 (1% of one stake, not full pool)
  function drawSettle(stakeKas) {
    var fee = stakeKas * 0.01;
    return {
      refund:          stakeKas - fee,
      protocolFee:     fee,
      feeBreakdown:    '1% of ' + stakeKas.toFixed(4) + ' KAS stake',
      treasuryAddress: treasury(),
    };
  }

  function maximizerSplit(betKas) {
    return {
      poolContribution: betKas * MAXIMIZER_POOL_SPLIT,
      hedgeAmount:      betKas * MAXIMIZER_POOL_SPLIT,
    };
  }

  function maximizerWinSettle(betKas, odds) {
    var gross    = betKas * (odds || 2.0);
    var winnings = gross - betKas;
    var fee      = winnings * EVENT_WIN_PCT;
    return {
      netPayout:       gross - fee,
      protocolFee:     fee,
      treasuryAddress: treasury(),
    };
  }

  function maximizerLoseSettle(betKas) {
    var hedge = betKas * MAXIMIZER_POOL_SPLIT;
    var fee   = hedge * MAXIMIZER_HEDGE_LOSS;
    return {
      claimable:       hedge - fee,
      protocolFee:     fee,
      treasuryAddress: treasury(),
    };
  }

  function skillGameCanCreatorCancel(matchData) {
    var joined  = matchData.opponentJoined || (matchData.status === 'active');
    var allowed = !joined;
    return {
      allowed: allowed,
      reason:  allowed ? 'No opponent yet — full refund available' : 'Game already started — leaving counts as forfeit',
    };
  }

  function checkMaximizerAllowance(cfg, betKas) {
    var maxPct   = cfg.maxMaximizerPct       || 0.10;
    var expVol   = cfg.expectedVolume        || 100000;
    var curMxTot = cfg.currentMaximizerTotal || 0;
    var cap      = expVol * maxPct;
    var split    = maximizerSplit(betKas || 0);
    var wouldUse = curMxTot + split.poolContribution;
    var allowed  = wouldUse <= cap;
    return {
      allowed: allowed,
      reason:  allowed ? 'Maximizer capacity available' : 'Maximizer cap reached for this market',
      cap:     cap,
      used:    curMxTot,
    };
  }

  function treasuryAddress() { return treasury(); }

  // ── Async versions (call Rust backend) ───────────────────────────────────
  var async_ = {
    skillGameSettle: function(stakeKas) {
      return post('/fee/skill-settle', { stake_kas: stakeKas, network: net() });
    },
    drawSettle: function(stakeKas) {
      return post('/fee/draw-settle', { stake_kas: stakeKas, network: net() });
    },
    maximizerWin: function(betKas, odds) {
      return post('/fee/maximizer-win', { bet_kas: betKas, odds: odds || 2.0, network: net() });
    },
    maximizerLose: function(betKas) {
      return post('/fee/maximizer-lose', { bet_kas: betKas, network: net() });
    },
    treasury: function() {
      return post('/fee/treasury', { network: net() });
    },
    cancelCheck: function(gameStatus, opponentJoined) {
      return post('/fee/cancel-check', { game_status: gameStatus, opponent_joined: opponentJoined });
    },
  };

  W.HTPFee = {
    skillGameSettle:           skillGameSettle,
    drawSettle:                drawSettle,
    maximizerSplit:            maximizerSplit,
    maximizerWinSettle:        maximizerWinSettle,
    maximizerLoseSettle:       maximizerLoseSettle,
    skillGameCanCreatorCancel: skillGameCanCreatorCancel,
    checkMaximizerAllowance:   checkMaximizerAllowance,
    treasuryAddress:           treasuryAddress,
    async:                     async_,
  };

  console.log('[HTPFee Shim v2.0] loaded — draw fee fix applied | sync JS + async Rust /fee/*');
})(window);
