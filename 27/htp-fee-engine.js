/* htp-fee-engine.js — HTP Fee Engine stub v1.0 */
(function(){
  'use strict';
  console.log('[HTP Fee Engine] loaded');

  var W = window;

  W.HTPFeeEngine = {
    /* 2% protocol fee on winner payout */
    calcWinFee: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee  = pool * 0.02;
      return { pool: pool, fee: fee, payout: pool - fee };
    },
    /* 1% fee on single stake for draw */
    calcDrawFee: function(stakeKas) {
      var fee = stakeKas * 0.01;
      return { refund: stakeKas - fee, fee: fee };
    },
    getTreasuryAddress: function() {
      return W.HTP_TREASURY_ADDR ||
             'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
    }
  };
})();
