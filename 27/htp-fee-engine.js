/* htp-fee-engine.js */
(function(){'use strict';window.HTPFeeEngine={calcFee:function(s){return s*0.02;},calcDraw:function(s){return{refund:s*0.99,fee:s*0.01};}};console.log('[HTP Fee Engine] loaded');})();
