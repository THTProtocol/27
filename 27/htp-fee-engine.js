/* htp-fee-engine.js — HTP Fee Engine stub v1.0 */
(function(){
  'use strict';
  console.log('[HTP Fee Engine] loaded');

  var PROTOCOL_FEE = 0.02;
  var TREASURY = window.HTP_TREASURY_ADDR || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';

  window.HTPFeeEngine = {
    calcWinFee: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee  = pool * PROTOCOL_FEE;
      return { pool: pool, fee: fee, payout: pool - fee, treasuryAddress: TREASURY };
    },
    calcDrawFee: function(stakeKas) {
      var fee = stakeKas * 0.01;
      return { refund: stakeKas - fee, protocolFee: fee, treasuryAddress: TREASURY };
    },
    treasuryAddress: function() { return TREASURY; }
  };
})();
