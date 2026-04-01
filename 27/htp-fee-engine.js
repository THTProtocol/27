/**
 * htp-fee-engine.js v2.0 — HTP Protocol Fee & Maximizer Engine
 *
 * FEE RULES:
 *   Skill games (1v1, winner-takes-all):
 *     - Winner pays 2% protocol fee on total pool
 *     - Creator can cancel anytime before opponent joins (full refund)
 *     - Creator who leaves after game starts = forfeit (counted as loss, no refund)
 *
 *   Events (parimutuel pools):
 *     - Standard bet: full amount goes to pool
 *     - Maximizer bet: 50% to pool, 50% hedged
 *       WIN:  payout as if 100% was in pool × odds, then 2% fee on winnings
 *       LOSE: can claim 50% hedge back, but pays 30% of hedge as protocol fee
 *              → net hedge recovery = 50% × 0.70 = 35% of original bet
 *     - Maximizers are parasitic (lower odds for everyone) — event creators can
 *       limit them via maxMaximizerPct + expectedVolume
 *
 * TREASURY:
 *   mainnet:    kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel
 *   testnet-12: kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m
 *
 * Load order: AFTER firebase-config.js, BEFORE htp-events-v3.js
 */

(function () {
  'use strict';

  // ── Treasury addresses ─────────────────────────────────────────────────
  const TREASURY = {
    'mainnet':     'kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel',
    'testnet-12':  'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m',
  };

  // ── Fee constants ──────────────────────────────────────────────────────
  const FEES = {
    SKILL_GAME_WIN_PCT:       0.02,   // 2% on total pool, paid by winner
    EVENT_WIN_PCT:            0.02,   // 2% on winnings for maximizer wins
    MAXIMIZER_HEDGE_LOSS_PCT: 0.30,   // 30% of hedge taken if maximizer loses
    MAXIMIZER_POOL_CONTRIBUTION: 0.50, // 50% of bet goes to pool, 50% hedged
  };

  // ── Network helper ─────────────────────────────────────────────────────
  function networkId() {
    return window.HTP_NETWORK || 'mainnet';
  }

  function treasuryAddress() {
    return TREASURY[networkId()];
  }

  // ══════════════════════════════════════════════════════════════════════
  // SKILL GAMES
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Calculate skill game settlement amounts.
   * @param {number} stakeKas — stake per player (each player puts in this amount)
   * @returns {{ totalPool, protocolFee, winnerPayout, treasuryAddress }}
   */
  function skillGameSettle(stakeKas) {
    const totalPool   = stakeKas * 2;
    const protocolFee = totalPool * FEES.SKILL_GAME_WIN_PCT;
    const winnerPayout = totalPool - protocolFee;
    return {
      totalPool,
      protocolFee,
      winnerPayout,
      feeBreakdown: `2% of ${totalPool.toFixed(4)} KAS pool`,
      treasuryAddress: treasuryAddress(),
    };
  }

  /**
   * Can the skill game creator cancel?
   * @param {object} game — { status, opponentJoined, creatorAddress, callerAddress }
   */
  function skillGameCanCreatorCancel(game) {
    if (game.opponentJoined) {
      return { allowed: false, reason: 'Game already started — leaving counts as forfeit' };
    }
    return { allowed: true, reason: 'No opponent yet — full refund available' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MAXIMIZER LOGIC
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Calculate how much of a maximizer bet goes to pool vs hedge.
   * @param {number} betKas
   * @returns {{ poolContribution, hedgeAmount, effectivePoolBet }}
   */
  function maximizerSplit(betKas) {
    const poolContribution = betKas * FEES.MAXIMIZER_POOL_CONTRIBUTION;
    const hedgeAmount      = betKas * FEES.MAXIMIZER_POOL_CONTRIBUTION;
    return { poolContribution, hedgeAmount, effectivePoolBet: poolContribution };
  }

  /**
   * Maximizer WIN payout.
   * Receives payout as if full betKas was in the pool × odds,
   * then pays 2% fee on net winnings.
   * @param {number} betKas    — original full bet amount
   * @param {number} odds      — final parimutuel odds (e.g. 2.5 = 2.5x)
   * @returns {{ grossPayout, protocolFee, netPayout, hedgeReturned }}
   */
  function maximizerWinSettle(betKas, odds) {
    const grossPayout  = betKas * odds;          // as if full amount was in pool
    const netWinnings  = grossPayout - betKas;   // profit only
    const protocolFee  = netWinnings * FEES.EVENT_WIN_PCT;
    const netPayout    = grossPayout - protocolFee;
    const { hedgeAmount } = maximizerSplit(betKas);
    // hedge is returned as part of payout (was never at risk for odds, was at risk for fee)
    return {
      grossPayout,
      protocolFee,
      netPayout,
      hedgeReturned: hedgeAmount,
      feeBreakdown: `2% of ${netWinnings.toFixed(4)} KAS winnings`,
      treasuryAddress: treasuryAddress(),
    };
  }

  /**
   * Maximizer LOSS settlement.
   * Maximizer lost, but can claim hedge back minus 30% protocol fee.
   * @param {number} betKas — original full bet amount
   * @returns {{ hedgeAmount, protocolFee, claimable, poolLoss }}
   */
  function maximizerLoseSettle(betKas) {
    const { hedgeAmount } = maximizerSplit(betKas);
    const protocolFee = hedgeAmount * FEES.MAXIMIZER_HEDGE_LOSS_PCT;
    const claimable   = hedgeAmount - protocolFee;   // 50% × 0.70 = 35% of original bet
    return {
      hedgeAmount,
      protocolFee,
      claimable,
      poolLoss: betKas * FEES.MAXIMIZER_POOL_CONTRIBUTION,  // the 50% in pool is gone
      feeBreakdown: `30% of ${hedgeAmount.toFixed(4)} KAS hedge`,
      treasuryAddress: treasuryAddress(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MAXIMIZER ALLOWANCE (event creator controls)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Check if a new maximizer bet is allowed for this event.
   *
   * Mechanism:
   *   maxMaximizerPct × currentVolume = current maximizer cap
   *   if (currentMaximizerTotal + newBet) > cap → reject
   *
   * The cap scales with actual volume, so as the event grows,
   * more maximizer capacity opens up proportionally.
   *
   * @param {object} event
   *   event.maxMaximizerPct     — creator-set limit, e.g. 0.10 for 10%
   *   event.expectedVolume      — creator's expected total pool in KAS
   *   event.currentVolume       — actual current pool in KAS
   *   event.currentMaximizerTotal — total maximizer pool contributions so far
   * @param {number} newBetKas   — the new maximizer bet amount
   * @returns {{ allowed, cap, used, available, reason }}
   */
  function checkMaximizerAllowance(event, newBetKas) {
    const {
      maxMaximizerPct = 0,         // default 0 = no maximizers allowed
      expectedVolume  = 0,
      currentVolume   = 0,
      currentMaximizerTotal = 0,
    } = event;

    if (maxMaximizerPct === 0) {
      return { allowed: false, reason: 'Event creator disabled maximizers' };
    }

    // Cap is based on the GREATER of expected vs actual volume
    // (protects creators: they can't be gamed by low early volume)
    const referenceVolume = Math.max(expectedVolume, currentVolume);
    const cap       = referenceVolume * maxMaximizerPct;
    const { poolContribution } = maximizerSplit(newBetKas);
    const used      = currentMaximizerTotal;
    const available = Math.max(0, cap - used);

    if (poolContribution > available) {
      return {
        allowed: false,
        cap,
        used,
        available,
        reason: `Maximizer cap reached: ${used.toFixed(2)}/${cap.toFixed(2)} KAS used (${(maxMaximizerPct * 100).toFixed(0)}% of ${referenceVolume.toFixed(0)} KAS reference volume)`,
      };
    }

    return {
      allowed: true,
      cap,
      used,
      available,
      newUsed: used + poolContribution,
      reason: `OK — ${available.toFixed(2)} KAS maximizer capacity remaining`,
    };
  }

  /**
   * Calculate the effective maximizer cap given current state.
   * Returns how much MORE maximizer volume is permitted.
   */
  function maximizerCapRemaining(event) {
    const { maxMaximizerPct = 0, expectedVolume = 0, currentVolume = 0, currentMaximizerTotal = 0 } = event;
    const referenceVolume = Math.max(expectedVolume, currentVolume);
    const cap = referenceVolume * maxMaximizerPct;
    return Math.max(0, cap - currentMaximizerTotal);
  }

  // ══════════════════════════════════════════════════════════════════════
  // STANDARD EVENT BET (non-maximizer)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Standard parimutuel win payout (no maximizer involved).
   * @param {number} betKas
   * @param {number} odds — final parimutuel odds
   */
  function standardEventWinSettle(betKas, odds) {
    const grossPayout  = betKas * odds;
    const netWinnings  = grossPayout - betKas;
    const protocolFee  = netWinnings * FEES.EVENT_WIN_PCT;
    const netPayout    = grossPayout - protocolFee;
    return {
      grossPayout,
      protocolFee,
      netPayout,
      feeBreakdown: `2% of ${netWinnings.toFixed(4)} KAS winnings`,
      treasuryAddress: treasuryAddress(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARY / DEBUG HELPER
  // ══════════════════════════════════════════════════════════════════════

  function summarize(type, params) {
    switch (type) {
      case 'skill_win':
        return skillGameSettle(params.stakeKas);
      case 'maximizer_win':
        return maximizerWinSettle(params.betKas, params.odds);
      case 'maximizer_lose':
        return maximizerLoseSettle(params.betKas);
      case 'standard_win':
        return standardEventWinSettle(params.betKas, params.odds);
      default:
        throw new Error(`Unknown fee type: ${type}`);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.HTPFee = {
    FEES,
    TREASURY,
    treasuryAddress,
    networkId,

    // Skill games
    skillGameSettle,
    skillGameCanCreatorCancel,

    // Events — maximizer
    maximizerSplit,
    maximizerWinSettle,
    maximizerLoseSettle,
    checkMaximizerAllowance,
    maximizerCapRemaining,

    // Events — standard
    standardEventWinSettle,

    // Generic
    summarize,
  };

  console.log(`[HTPFee] v2.0 loaded — treasury: ${treasuryAddress()}`);
})();
