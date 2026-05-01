/* htp-wallet-fix.js — v15 */
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

  // ── Seed demo events ───────────────────────────────────────────────────────
  // Waits for window.htpMarkets OR window.mkts to exist (bridged from index.html),
  // then seeds two demo prediction events so Spot/Maximizer UI can be tested.
  function seedDemoEvent(){
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(tries>40){ clearInterval(t); return; }

      // Accept either array reference
      var mkts = window.htpMarkets || window._htpMarkets || window.mkts;
      if(!mkts) return;
      clearInterval(t);

      var DEMOS = [
        {
          id:'demo-001', marketId:'demo-001',
          title:'Will Kaspa reach $1 before end of 2025?',
          question:'Will Kaspa reach $1 before end of 2025?',
          cat:'Crypto', category:'Crypto',
          st:'open', status:'active',
          outcomes:['Yes','No'],
          yP:67, nP:33, yM:'1.5', nM:'3.0', outMap:null,
          pool:15000, ent:42,
          closeTime:Date.now()+7*24*3600000,
          createdAt:Date.now()-3600000,
          cl:'6d 23h', src:'CoinGecko',
          resolution:'Bonded + CoinGecko', creatorBond:1000,
          fee:'Spot: 2% on winnings | Maximizer: 50% loss cushion',
          net:'both', img:'',
          desc:'Binary parimutuel market on Kaspa price milestone.',
          deadline:'2025-12-31', created:'2026-05-01'
        },
        {
          id:'demo-002', marketId:'demo-002',
          title:'Will Bitcoin hit $120K this year?',
          question:'Will Bitcoin hit $120K this year?',
          cat:'Crypto', category:'Crypto',
          st:'open', status:'active',
          outcomes:['Yes','No'],
          yP:54, nP:46, yM:'1.85', nM:'2.17', outMap:null,
          pool:32000, ent:88,
          closeTime:Date.now()+14*24*3600000,
          createdAt:Date.now()-7200000,
          cl:'14d 5h', src:'CoinGecko',
          resolution:'Bonded + CoinGecko', creatorBond:1000,
          fee:'Spot: 2% on winnings | Maximizer: 50% loss cushion',
          net:'both', img:'',
          desc:'Binary parimutuel market on Bitcoin ATH.',
          deadline:'2026-12-31', created:'2026-05-01'
        }
      ];

      var changed = false;
      DEMOS.forEach(function(d){
        var exists = mkts.some(function(m){ return m.id===d.id || m.marketId===d.id; });
        if(!exists){ mkts.push(d); changed=true; }
      });

      // Keep all window references in sync
      window.mkts = mkts;
      window.htpMarkets = mkts;
      window._htpMarkets = mkts;

      if(changed){
        console.log('[HTP] Demo events seeded (' + mkts.length + ' total)');
        setTimeout(function(){
          if(typeof window.renderM==='function') window.renderM();
          if(typeof window.buildF==='function') window.buildF();
        }, 100);
      }
    },250);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){ patchMultiplier(); seedDemoEvent(); });
  }else{
    patchMultiplier();
    seedDemoEvent();
  }

  // Re-seed when markets view becomes active
  window.addEventListener('htp:markets:loaded', seedDemoEvent);
  window.addEventListener('htp:view:markets', function(){ setTimeout(seedDemoEvent, 300); });

})();
