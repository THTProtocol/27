/* htp-wallet-fix.js — v12 stub */
(function(){
  function sync(){
    if(typeof window._htpSetConnectNet!=='function') return;
    var cur=window.activeNet||'tn12';
    ['ns-mn','ns-hx'].forEach(function(sid){
      var el=document.querySelector('[data-net-sel="'+sid+'"]');
      if(el) window._htpSetConnectNet(sid,cur);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',sync);
  else sync();
})();
