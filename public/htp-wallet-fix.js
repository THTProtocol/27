/* htp-wallet-fix.js — v13 */
(function(){
  // Sync network selectors
  function syncNets(){
    if(typeof window._htpSetConnectNet!=='function') return;
    var cur=window.activeNet||'tn12';
    ['ns-mn','ns-hx'].forEach(function(sid){
      var el=document.querySelector('[data-net-sel="'+sid+'"]');
      if(el) window._htpSetConnectNet(sid,cur);
    });
  }

  // Fix "undefinedx" in outcome buttons: patch updTrade to ensure mult always has a value
  function patchMultiplier(){
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(tries>40){ clearInterval(t); return; }
      var ob=document.getElementById('outcomeBtns');
      if(!ob) return;
      clearInterval(t);
      // MutationObserver to patch multiplier display after each render
      var observer=new MutationObserver(function(){
        ob.querySelectorAll('.to-m').forEach(function(el){
          if(el.textContent.indexOf('undefinedx')!==-1){
            var pctMatch=el.textContent.match(/([\d.]+)%/);
            if(pctMatch){
              var pct=parseFloat(pctMatch[1]);
              var mult=pct>0?(100/pct).toFixed(1):'--';
              el.textContent=pctMatch[1]+'% '+mult+'x';
            }
          }
        });
      });
      observer.observe(ob,{childList:true,subtree:true});
    },250);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){ syncNets(); patchMultiplier(); });
  }else{
    syncNets();
    patchMultiplier();
  }
})();
