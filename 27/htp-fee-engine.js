/* htp-fee-engine.js v1.0 — Fee calculation engine */
(function(){
  'use strict';
  var W = window;
  W.HTPFeeEngine = {
    PROTOCOL_FEE: 0.02,
    calcWin: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee = pool * this.PROTOCOL_FEE;
      return { pool: pool, fee: fee, payout: pool - fee };
    },
    calcDraw: function(stakeKas) {
      var fee = stakeKas * 0.01;
      return { refund: stakeKas - fee, fee: fee };
    },
    treasury: function() {
      return W.HTP_FEE_ADDR || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
    }
  };
  console.log('[HTP Fee Engine v1.0] loaded');
})();
