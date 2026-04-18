/* htp-fee-engine.js — HTP Fee Engine stub v1.0 */
(function() {
  'use strict';
  console.log('[HTP Fee Engine] loaded');

  window.HTPFeeEngine = {
    /* 2% protocol fee on winnings only */
    calcWinFee: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee  = pool * 0.02;
      return { pool: pool, fee: fee, payout: pool - fee };
    },
    /* Draw: 1% of one player stake refunded as fee */
    calcDrawFee: function(stakeKas) {
      var fee = stakeKas * 0.01;
      return { refund: stakeKas - fee, fee: fee };
    }
  };
})();
