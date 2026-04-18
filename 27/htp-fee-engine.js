/* htp-fee-engine.js — HTP Fee Engine v1.0 */
(function(){
  'use strict';
  console.log('[HTP Fee Engine v1.0] loaded');

  var W = window;
  var PROTOCOL_FEE_RATE = 0.02; // 2%
  var DRAW_FEE_RATE = 0.01;     // 1% of one stake

  W.HTPFeeEngine = {
    /**
     * Calculate win payout
     * @param {number} stakeKas - stake per player in KAS
     * @returns {{ pool, fee, payout, treasuryAddress }}
     */
    calcWin: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee = pool * PROTOCOL_FEE_RATE;
      var payout = pool - fee;
      return {
        pool: pool,
        fee: fee,
        payout: payout,
        treasuryAddress: W.HTP_TREASURY_ADDR || W.htpTreasury || ''
      };
    },

    /**
     * Calculate draw refund
     * @param {number} stakeKas
     * @returns {{ refund, protocolFee, treasuryAddress }}
     */
    calcDraw: function(stakeKas) {
      var fee = stakeKas * DRAW_FEE_RATE;
      return {
        refund: stakeKas - fee,
        protocolFee: fee,
        treasuryAddress: W.HTP_TREASURY_ADDR || W.htpTreasury || ''
      };
    },

    /**
     * Get raw fee rate
     */
    getFeeRate: function() { return PROTOCOL_FEE_RATE; },
    getDrawFeeRate: function() { return DRAW_FEE_RATE; }
  };

  // Alias for legacy callers
  W.htpCalcWinPayout = W.HTPFeeEngine.calcWin;
  W.htpCalcDrawRefund = W.HTPFeeEngine.calcDraw;
})();
