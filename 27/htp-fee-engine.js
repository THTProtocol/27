/* htp-fee-engine.js — HTP Fee Engine stub
 * Referenced by index.html; full logic lives in htp-fee-shim.js
 */
(function(){
  'use strict';
  console.log('[HTP Fee Engine] loaded');

  // Expose a minimal fee engine so nothing breaks
  window.HTPFeeEngine = window.HTPFeeEngine || {
    // 2% protocol fee on the winner's gross payout
    PROTOCOL_FEE_PCT: 0.02,

    /** Win: winner takes pool minus protocol fee */
    winSettle: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee  = pool * this.PROTOCOL_FEE_PCT;
      return { payout: pool - fee, protocolFee: fee, pool: pool };
    },

    /** Draw: each player gets stake minus 1% of their own stake */
    drawSettle: function(stakeKas) {
      var fee = stakeKas * 0.01;
      return { refund: stakeKas - fee, protocolFee: fee };
    },

    /** Treasury address (falls back to shim if loaded) */
    treasury: function() {
      if (window.HTPFee && typeof window.HTPFee.treasury === 'function') {
        return window.HTPFee.treasury();
      }
      return window._htpTreasuryAddr || '';
    }
  };
})();
