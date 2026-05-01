/* htp-wallet-fix.js — v14 */
(function(){

  // ── Fix "undefinedx" in outcome buttons ───────────────────────────────────
  function patchMultiplier(){
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(tries>40){ clearInterval(t); return; }
      var ob=document.getElementById('outcomeBtns');
      if(!ob){ return; }
      clearInterval(t);
      var observer=new MutationObserver(function(){
        ob.querySelectorAll('.to-m').forEach(function(el){
          if(el.textContent.indexOf('undefinedx')!==-1){
            var m=el.textContent.match(/([\d.]+)%/);
            if(m){
              var pct=parseFloat(m[1]);
              var mult=pct>0?(100/pct).toFixed(1):'--';
              el.textContent=m[1]+'% '+mult+'x';
            }
          }
        });
      });
      observer.observe(ob,{childList:true,subtree:true});
    },250);
  }

  // ── Auto-seed a demo prediction event for testing ─────────────────────────
  // Creates one active test event if none exist, so Spot/Maximizer UI can be tested
  function seedDemoEvent(){
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(tries>30){ clearInterval(t); return; }
      if(!window.htpMarkets && !window._htpMarkets) return;
      clearInterval(t);
      var mkts=window.htpMarkets||window._htpMarkets||[];
      var hasDemo=mkts.some(function(m){ return m.marketId==='demo-001'; });
      if(hasDemo) return;
      var demo={
        marketId:'demo-001',
        question:'Will Kaspa reach $1 by end of 2025?',
        category:'Crypto',
        status:'active',
        outcomes:['Yes','No'],
        yP:67, nP:33,
        yM:'1.5', nM:'3.0',
        outMap:null,
        pool:15000,
        ent:42,
        closeTime:Date.now()+7*24*3600000,
        createdAt:Date.now()-3600000,
        src:'CoinGecko',
        resolution:'Bonded + ZK-Verified',
        cl:'6d 23h',
        creatorBond:1000,
        fee:'Spot: 2% | Maximizer: 50% cushion',
        net:'both',
        img:''
      };
      mkts.push(demo);
      if(window.htpMarkets) window.htpMarkets=mkts;
      if(window._htpMarkets) window._htpMarkets=mkts;
      if(typeof window.renderM==='function') window.renderM();
      if(typeof window.buildF==='function') window.buildF();
    },400);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){ patchMultiplier(); seedDemoEvent(); });
  }else{
    patchMultiplier();
    seedDemoEvent();
  }

  // Re-seed when markets view loads
  window.addEventListener('htp:markets:loaded', seedDemoEvent);
  window.addEventListener('htp:view:markets', function(){ setTimeout(seedDemoEvent,500); });

})();
