/**
 * htp-wallet-fix.js — v9.0
 * Network selectors only — selWallet and mobile toggle live in htp-wallet-logos.js.
 * This file is a safety no-op that defers to htp-wallet-logos.js.
 * It will NOT inject duplicate selectors.
 */
(function(){
  function trySync() {
    if (typeof window._htpSetConnectNet !== 'function') return;
    var cur = window.activeNet || 'tn12';
    ['ns-mn','ns-hx'].forEach(function(sid){
      var el = document.querySelector('[data-net-sel="'+sid+'"]');
      if (el) window._htpSetConnectNet(sid, cur);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', trySync);
  else trySync();
})();
