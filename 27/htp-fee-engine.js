/* htp-fee-engine.js — stub v1.0 */
(function(){
  'use strict';
  console.log('[HTP Fee Engine] stub loaded');
  window.HTPFeeEngine = window.HTPFeeEngine || {
    calcFee: function(stakeKas) { return stakeKas * 0.02; },
    calcDrawFee: function(stakeKas) { return stakeKas * 0.01; },
    version: '1.0-stub'
  };
})();
