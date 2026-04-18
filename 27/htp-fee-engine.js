/* htp-fee-engine.js — HTP Fee Engine v1.0 */
(function(){
  'use strict';
  var W = window;

  // Fee constants
  var PROTOCOL_FEE_RATE = 0.02; // 2%
  var DRAW_FEE_RATE     = 0.01; // 1% of one stake

  W.HTPFeeEngine = {
    /**
     * Calculate win payout
     * @param {number} stakeKas - each player's stake
     * @returns {{ pool, fee, payout, treasuryAddress }}
     */
    calcWin: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee  = pool * PROTOCOL_FEE_RATE;
      var payout = pool - fee;
      return {
        pool: pool,
        fee: fee,
        payout: payout,
        protocolFeeRate: PROTOCOL_FEE_RATE,
        treasuryAddress: W.HTP_TREASURY_ADDRESS || ''
      };
    },

    /**
     * Calculate draw refund
     * @param {number} stakeKas - each player's stake
     * @returns {{ refund, protocolFee, treasuryAddress }}
     */
    calcDraw: function(stakeKas) {
      var fee    = stakeKas * DRAW_FEE_RATE;
      var refund = stakeKas - fee;
      return {
        refund: refund,
        protocolFee: fee,
        treasuryAddress: W.HTP_TREASURY_ADDRESS || ''
      };
    }
  };

  // Also expose on HTPFeeShim namespace for back-compat
  if (!W.HTPFee) W.HTPFee = {};
  W.HTPFee.calcWin  = W.HTPFeeEngine.calcWin;
  W.HTPFee.calcDraw = W.HTPFeeEngine.calcDraw;

  console.log('[HTP Fee Engine v1.0] loaded — win: 2% of pool, draw: 1% of stake');
})();
