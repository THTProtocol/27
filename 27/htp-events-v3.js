/**
 * htp-events-v3.js — SHIM v2.0
 *
 * Odds computation moved to Rust (markets.rs → POST /markets/odds).
 * Firebase listener and card rendering remain in the browser (DOM-only work).
 */
(function() {
  'use strict';

  var BASE = window.HTP_RUST_API || 'https://htp-backend-<YOUR_CLOUD_RUN_HASH>.run.app';
  var marketsRef = null;

  function truncateAddr(a) { return a && a.length > 16 ? a.slice(0,10)+'...'+a.slice(-6) : (a||'--'); }
  function formatDate(ts) {
    if (!ts) return '--';
    return new Date(ts < 1e12 ? ts*1000 : ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }

  async function computeOdds(outcomes, positions) {
    var totals = (outcomes||[]).map(function(_,idx) {
      return Object.values(positions||{}).reduce(function(s,p){ return s+(p&&p.outcomeIndex===idx?(p.size||0):0);},0);
    });
    try {
      var r = await fetch(BASE+'/markets/odds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({position_totals:totals})});
      if (r.ok) { var d=await r.json(); return d.odds_pct; }
    } catch(e) {}
    var n=totals.length; var even=n>0?100/n:100;
    return totals.map(function(){return even;});
  }

  async function renderCard(market) {
    var odds = await computeOdds(market.outcomes, market.positions);
    var html = '<div class="market-card" id="mc-'+market.marketId+'">';
    html += '<div class="market-header" onclick="window.htpToggleMarket(\''+market.marketId+'\')">';
    html += '<h3 class="market-title">'+market.title+'</h3>';
    html += '<span class="market-pool">'+((market.totalPool||0).toFixed(2))+' KAS</span></div>';
    html += '<div class="market-outcomes">';
    (market.outcomes||[]).forEach(function(o,i){
      var pct=(odds[i]||0).toFixed(1);
      html+='<div class="market-outcome-row"><div class="outcome-info"><span class="outcome-name">'+o+'</span><span class="outcome-odds">'+pct+'%</span></div>';
      html+='<div class="outcome-bar"><div class="outcome-bar-fill" style="width:'+pct+'%"></div></div>';
      html+='<div class="outcome-action"><input type="number" class="input outcome-bet-input" placeholder="KAS" min="'+(market.minPosition||1)+'" data-outcome-idx="'+i+'" data-market-id="'+(market.marketId||'')+'">';
      html+='<button class="btn btn-primary btn-sm" onclick="window.htpPlaceBet(\''+market.marketId+'\','+i+')">Bet</button></div></div>';
    });
    html+='</div><div class="market-meta">Resolution: '+formatDate(market.resolutionDate)+'</div></div>';
    return html;
  }

  async function renderMarkets(markets) {
    var c=document.getElementById('active-markets'); if(!c) return;
    if(!markets||!markets.length){c.innerHTML='<p class="text-muted">No active prediction markets yet.</p>';return;}
    markets.sort(function(a,b){return(b.createdAt||0)-(a.createdAt||0);});
    var htmls = await Promise.all(markets.map(renderCard));
    c.innerHTML = htmls.join('');
  }

  window.htpToggleMarket = function(id) {
    if (marketsRef) marketsRef.orderByChild('status').equalTo('active').once('value',function(s){
      var ms=[]; s.exists()&&s.forEach(function(c){var m=c.val();if(m){m.marketId=m.marketId||c.key;ms.push(m);}});
      renderMarkets(ms);
    });
  };

  window.htpPlaceBet = async function(marketId, outcomeIndex) {
    var addr=window.walletAddress||window.htpAddress; if(!addr){if(window.openWalletModal)window.openWalletModal();return;}
    var inp=document.querySelector('input[data-market-id="'+marketId+'"][data-outcome-idx="'+outcomeIndex+'"]');
    var amt=inp?parseFloat(inp.value):0;
    if(!amt||amt<=0){if(window.showToast)window.showToast('Enter a bet amount','error');return;}
    try {
      var r=await fetch(BASE+'/markets/bet',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({market_id:marketId,player_address:addr,outcome_index:outcomeIndex,amount_kas:amt})});
      if(!r.ok) throw new Error(await r.text());
      var pos=await r.json();
      var db=window.firebase&&window.firebase.database?window.firebase.database():null;
      if(db) await db.ref('markets/'+marketId+'/positions/'+pos.position_id).set({outcomeIndex:outcomeIndex,size:amt,address:addr,ts:Date.now()});
      if(window.showToast)window.showToast('Bet placed!','success');
    } catch(e){if(window.showToast)window.showToast('Bet failed: '+e.message,'error');}
  };

  function listenMarkets() {
    var db=window.firebase&&window.firebase.database?window.firebase.database():null; if(!db) return;
    marketsRef=db.ref('markets');
    marketsRef.orderByChild('status').equalTo('active').on('value',function(s){
      var ms=[]; s.exists()&&s.forEach(function(c){var m=c.val();if(m){m.marketId=m.marketId||c.key;ms.push(m);}});
      renderMarkets(ms);
    });
  }
  document.addEventListener('DOMContentLoaded', listenMarkets);
  if(document.readyState!=='loading') listenMarkets();

  console.log('[HTP Events Shim v2.0] odds via Rust, Firebase listener active');
})();
