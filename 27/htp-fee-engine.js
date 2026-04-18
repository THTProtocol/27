/* htp-fee-engine.js — HTP Fee Engine stub v1.0 */
(function() {
  'use strict';
  console.log('[HTP Fee Engine] loaded');
  window.HTPFeeEngine = {
    calcFee: function(stakeKas, mode) {
      var rate = (mode === 'draw') ? 0.01 : 0.02;
      return parseFloat((stakeKas * rate).toFixed(8));
    },
    calcPayout: function(stakeKas, mode) {
      var pool = stakeKas * 2;
      var fee = this.calcFee(stakeKas, mode);
      return parseFloat((pool - fee).toFixed(8));
    },
    calcDrawRefund: function(stakeKas) {
      var fee = this.calcFee(stakeKas, 'draw');
      return parseFloat((stakeKas - fee).toFixed(8));
    }
  };
})();
