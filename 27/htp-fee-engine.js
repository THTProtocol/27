// htp-fee-engine.js v1.0
(function(){
  'use strict';
  window.HTPFeeEngine = {
    TREASURY_MAINNET: 'kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel',
    TREASURY_TN12: 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m',
    getTreasury: function() {
      var net = (window.localStorage.getItem('htp_network') || 'tn12').toLowerCase();
      return net === 'mainnet' ? this.TREASURY_MAINNET : this.TREASURY_TN12;
    },
    // Skill game: winner pays 2% protocol fee on full pool, winner takes rest
    skillWin: function(stakeKas) {
      var pool = stakeKas * 2;
      var fee  = pool * 0.02;
      return { payout: pool - fee, fee: fee, treasury: this.getTreasury() };
    },
    // Skill game: draw — 1% of one stake per player
    skillDraw: function(stakeKas) {
      var fee = stakeKas * 0.01;
      return { refund: stakeKas - fee, fee: fee, treasury: this.getTreasury() };
    },
    // Event market: winner's share after 2% pool fee
    eventWin: function(poolKas, shareRatio) {
      var fee    = poolKas * 0.02;
      var net    = poolKas - fee;
      var payout = net * shareRatio;
      return { payout: payout, fee: fee, treasury: this.getTreasury() };
    }
  };
  console.log('[HTP Fee Engine v1.0] loaded — treasury:', window.HTPFeeEngine.getTreasury());
})();
