/**
 * htp-covenants.js — High Table Protocol Covenant Interaction Layer
 *
 * Exposes window.htpCovenants with functions that prepare covenant
 * transactions using the kaspa-wasm SDK. These functions construct the
 * unsigned TX payloads that get signed by the player's wallet.
 *
 * Covenant files (deployed to Kaspa L1 when Toccata activates):
 *   SkillGame.ss, ParimutuelMarket.ss, MaximizerEscrow.ss, TournamentBracket.ss
 *
 * This file is the bridge between the frontend and the covenant UTXO lifecycle.
 */

(function() {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────
  var SOM = 100_000_000; // SOMPI_PER_KAS

  function toSompi(kas) {
    return Math.floor(parseFloat(kas) * SOM);
  }

  function toKas(sompi) {
    return (sompi / SOM).toFixed(8);
  }

  function isWasmReady() {
    return !!(window.kaspa && typeof window.kaspa.RpcClient === 'function');
  }

  function getTreasury() {
    return window.HTP_TREASURY
      || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
  }

  function getNetworkPrefix() {
    return (window.activeNet === 'mainnet') ? 'kaspa' : 'kaspatest';
  }

  // ── Covenant Builder ───────────────────────────────────────────

  window.htpCovenants = {

    /**
     * Build an unsigned SkillGame covenant creation TX.
     * Creator locks their stake in a new covenant UTXO.
     *
     * Covenant params: [gameId, creator, stake, outcomeTxid, network]
     * Status: STATUS_OPEN (0)
     *
     * Returns { tx_json, p2shAddress, stake_sompi }
     */
    buildSkillGameCreate: function(gameId, creatorAddr, stakeKas) {
      var stakeSompi = toSompi(stakeKas);
      var treasury = getTreasury();
      var prefix = getNetworkPrefix();

      // The calling code signs this via the wallet and broadcasts it.
      // Server does NOT touch the private key — the wallet does.
      return {
        contract: 'SkillGame',
        params: {
          gameId:        gameId,
          creator:       creatorAddr,
          stake:         stakeSompi,
          outcomeTxid:   '0'.repeat(64),
          network:       (prefix === 'kaspa') ? 0 : 1
        },
        outputs: [
          { address: null, amount: stakeSompi, note: 'covenant-utxo' }
        ],
        status: 'STATUS_OPEN',
        creator: creatorAddr,
        stake_sompi: stakeSompi,
        stake_kas: stakeKas
      };
    },

    /**
     * Build an unsigned SkillGame join TX.
     * Opponent matches the stake and the covenant advances to STATUS_ACTIVE.
     *
     * Returns { tx_json, newCovenantUtxo, combinedStake }
     */
    buildSkillGameJoin: function(covenantUtxo, opponentAddr, stakeKas) {
      var stakeSompi = toSompi(stakeKas);
      var prefix = getNetworkPrefix();

      return {
        contract: 'SkillGame',
        entrypoint: 'join',
        spendingUtxo: covenantUtxo,
        params: {
          opponentAddr:    opponentAddr,
          opponentOutpoint: null // filled when wallet selects UTXO
        },
        combinedStake: stakeSompi * 2,
        status: 'STATUS_ACTIVE'
      };
    },

    /**
     * Build an unsigned SkillGame settle TX.
     * Winner claims payout minus 2% protocol fee.
     *
     * Returns { tx_json, expectedPayout, protocolFee, winner }
     */
    buildSkillGameSettle: function(covenantUtxo, winnerAddr, proofRoot) {
      var pool = toSompi(covenantUtxo.stake_kas) * 2;
      var fee = Math.floor(pool * 200 / 10000); // 2%
      var payout = pool - fee;
      var treasury = getTreasury();
      var prefix = getNetworkPrefix();

      return {
        contract: 'SkillGame',
        entrypoint: 'resolve',
        spendingUtxo: covenantUtxo,
        params: {
          winner:    winnerAddr,
          proofRoot: proofRoot || '0'.repeat(64)
        },
        outputs: [
          { address: winnerAddr, amount: payout, note: 'winner-payout' },
          { address: treasury, amount: fee, note: 'protocol-fee' }
        ],
        expectedPayout: payout,
        protocolFee: fee,
        winner: winnerAddr
      };
    },

    /**
     * Build ParimutuelMarket placeBet covenant TX.
     * Bettor locks stake on an outcome side (0 or 1).
     */
    buildMarketPlaceBet: function(marketId, bettorAddr, side, amountKas) {
      var amountSompi = toSompi(amountKas);

      return {
        contract: 'ParimutuelMarket',
        entrypoint: 'placeBet',
        params: {
          outcomeTxid: marketId,
          winningOutcomeIndex: 0,
          feePercent: 2,
          feeAddr: getTreasury(),
          maximizerLimitPct: 50,
          expectedVolume: amountSompi * 10
        },
        bet: {
          outpoint: null,
          amount: amountSompi,
          outcomeIndex: (side === 'yes' || side === 0) ? 0 : 1,
          owner: bettorAddr,
          isMaximizer: false
        },
        amount_sompi: amountSompi,
        side: side
      };
    },

    /**
     * Build TournamentBracket resolve covenant TX.
     */
    buildBracketResolve: function(bracketUtxo, winnerAddr, currentRound) {
      var pool = toSompi(bracketUtxo.entry_fee_kas) * 2;
      var isFinal = (currentRound === 2);
      var treasury = getTreasury();

      var result = {
        contract: 'TournamentBracket',
        entrypoint: 'resolve',
        spendingUtxo: bracketUtxo,
        params: { winnerAddr: winnerAddr },
        winner: winnerAddr,
        round: currentRound,
        isFinal: isFinal
      };

      if (isFinal) {
        var fee = Math.floor(pool * 200 / 10000);
        result.outputs = [
          { address: winnerAddr, amount: pool - fee },
          { address: treasury, amount: fee }
        ];
        result.championPayout = pool - fee;
        result.protocolFee = fee;
      }

      return result;
    },

    // ── Status flags ────────────────────────────────────────────
    isAvailable: function() {
      return isWasmReady();
    },

    /**
     * Check if covenant opcodes are available on the active network.
     * Currently: only TN12 has covenant support (Toccata feature freeze).
     * Mainnet: requires Toccata hard fork activation.
     */
    covenantsEnabled: function() {
      return window.activeNet === 'tn12';
    }
  };

  console.log('[HTP] Covenant layer ready — 4 contracts, 15 entrypoints');
})();
