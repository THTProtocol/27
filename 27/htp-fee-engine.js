/* htp-fee-engine.js — HTP Fee Engine v1.0 */
(function(){
  'use strict';
  var W = window;

  W.HTPFeeEngine = {
    FEE_RATE: 0.02,
    DRAW_FEE_RATE: 0.01,

    winFee: function(stakeKas) {
      var pool = stakeKas * 2;
      return { fee: pool * this.FEE_RATE, payout: pool * (1 - this.FEE_RATE) };
    },

    drawFee: function(stakeKas) {
      var fee = stakeKas * this.DRAW_FEE_RATE;
      return { fee: fee, refund: stakeKas - fee };
    },

    calcPayout: function(stakeKas, outcome) {
      if (outcome === 'draw') return this.drawFee(stakeKas);
      return this.winFee(stakeKas);
    }
  };

  console.log('[HTP Fee Engine v1.0] loaded');
})();
