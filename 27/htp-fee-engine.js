/* htp-fee-engine.js — HTP Fee Engine stub */
(function(){
  'use strict';
  console.log('[HTP Fee Engine] loaded');

  window.HTPFeeEngine = {
    calcFee: function(stakeKas) {
      return parseFloat((stakeKas * 0.02).toFixed(8));
    },
    calcPayout: function(stakeKas) {
      var fee = window.HTPFeeEngine.calcFee(stakeKas);
      return parseFloat((stakeKas * 2 - fee).toFixed(8));
    },
    calcDrawRefund: function(stakeKas) {
      var fee = parseFloat((stakeKas * 0.01).toFixed(8));
      return parseFloat((stakeKas - fee).toFixed(8));
    }
  };
})();
