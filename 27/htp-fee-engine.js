/* htp-fee-engine.js — HTP Fee Engine stub v1.0
 * Prevents 404/500 on script load. Real fee logic is handled by htp-fee-shim.js
 */
(function(){
  'use strict';
  console.log('[HTP Fee Engine] loaded');

  window.HTPFeeEngine = window.HTPFeeEngine || {
    // Returns protocol fee for a win payout
    winFee: function(stakeKas) {
      return stakeKas * 2 * 0.02; // 2% of pool
    },
    // Returns protocol fee for a draw — 1% of one player's stake (fixed)
    drawFee: function(stakeKas) {
      return stakeKas * 0.01;
    },
    // Returns net payout for winner
    winPayout: function(stakeKas) {
      var pool = stakeKas * 2;
      return pool - this.winFee(stakeKas);
    },
    // Returns refund per player on draw
    drawRefund: function(stakeKas) {
      return stakeKas - this.drawFee(stakeKas);
    }
  };
})();
