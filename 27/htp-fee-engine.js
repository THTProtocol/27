// htp-fee-engine.js v1.0 — HTP Fee Engine stub
(function() {
  'use strict';
  window.HTPFeeEngine = {
    calcFee: function(stakeKas) { return stakeKas * 0.02; },
    calcDraw: function(stakeKas) { return { fee: stakeKas * 0.01, refund: stakeKas * 0.99 }; }
  };
  console.log('[HTP Fee Engine] loaded');
})();
