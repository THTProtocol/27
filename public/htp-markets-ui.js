/**
 * htp-markets-ui.js — v13.0
 * Markets grid, categories, sorting, search, and fee disclosure.
 */
(function(W){
  'use strict';

  // ── Inject styles ──────────────────────────────────────────────────────────
  (function(){
    var sid='htp-mkt-styles-v8';
    if(document.getElementById(sid)) return;
    var s=document.createElement('style');
    s.id=sid;
    s.textContent=[
      '#mktHeader{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}',
      '.mkt-fi{flex:1;min-width:0;padding:10px 14px 10px 36px;background:rgba(8,13,26,.85);border:1px solid rgba(73,232,194,.11);border-radius:12px;color:#e2e8f0;font-size:13px;font-family:inherit;outline:none;transition:border-color .18s,box-shadow .18s;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2349e8c2\' stroke-width=\'2.5\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'m21 21-4.35-4.35\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:12px center}',
      '.mkt-fi:focus{border-color:rgba(73,232,194,.4);box-shadow:0 0 0 3px rgba(73,232,194,.1)}',
      '.mkt-fi::placeholder{color:#475569}',
      '.mkt-sort{flex-shrink:0;width:150px;padding:10px 12px;background:rgba(8,13,26,.85);border:1px solid rgba(73,232,194,.11);border-radius:12px;color:#64748b;font-size:12px;font-weight:600;font-family:inherit;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2349e8c2\' stroke-width=\'2.5\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:calc(100% - 10px) center;padding-right:28px}',
      '.mkt-sort:focus{border-color:rgba(73,232,194,.4)}',
      '#mktCatBar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}',
      '.mkt-cat{padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(73,232,194,.18);color:#64748b;background:rgba(255,255,255,.02);transition:all .18s}',
      '.mkt-cat:hover{border-color:rgba(73,232,194,.4);color:#94a3b8}',
      '.mkt-cat.act{background:rgba(73,232,194,.12);border-color:rgba(73,232,194,.5);color:#49e8c2}',
      '#mG{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}',
      '@media(max-width:600px){#mG{grid-template-columns:1fr}}',
      '.mc{background:rgba(8,13,26,.9);border:1px solid rgba(73,232,194,.08);border-radius:18px;overflow:hidden;cursor:pointer;transition:transform .2s cubic-bezier(.34,1.56,.64,1),border-color .2s,box-shadow .2s;display:flex;flex-direction:column}',
      '.mc:hover{transform:translateY(-4px);border-color:rgba(73,232,194,.3);box-shadow:0 16px 50px rgba(0,0,0,.6)}',
      '.htp-mc-cover{width:100%;overflow:hidden;background:rgba(73,232,194,.04)}',
      '.htp-mc-cover-img{display:block;width:100%;height:100%;object-fit:cover}',
      '.htp-mc-cover-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center}',
      '.mc-inner{padding:16px}',
      '.mc-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}',
      '.mc-q{font-size:15px;font-weight:700;color:#f1f5f9;line-height:1.4;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.mc-bar-wrap{display:flex;height:6px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.05);margin-bottom:6px}',
      '.mc-bar-y{background:var(--accent,#49e8c2);border-radius:3px}',
      '.mc-bar-n{background:rgba(239,68,68,.65);border-radius:3px}',
      '.mc-odds{display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:12px}',
      '.mc-meta{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#475569;padding-top:10px;border-top:1px solid rgba(255,255,255,.05)}',
      '.mc-pool{font-weight:700;color:#49e8c2}',
      '.mkt-empty{text-align:center;padding:48px 0;color:#475569}',
      '.mkt-empty svg{opacity:.25;margin-bottom:16px}',
      '.mkt-empty h3{font-size:16px;color:#64748b;margin-bottom:8px}',
      '#mktCount{font-size:11px;color:#475569;font-weight:600;margin-left:auto}'
    ].join('');
    document.head.appendChild(s);
  })();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getMkts(){return W.htpMarkets||W._htpMarkets||[];}
  function fmt(n){return n>=1000?(n/1000).toFixed(1)+'K':String(n||0);}
  function timeLeft(ts){
    var d=Math.max(0,ts-Date.now()),h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000);
    if(d<=0) return 'Closed';
    if(h>48) return Math.floor(h/24)+'d left';
    return h>0?h+'h '+m+'m left':m+'m left';
  }
  var CATS=['All','Sports','Crypto','Politics','Entertainment','Tech','Other'];
  var CAT_COLORS={'Sports':'rgba(59,130,246,.15)','Crypto':'rgba(245,158,11,.15)',
    'Politics':'rgba(239,68,68,.15)','Entertainment':'rgba(168,85,247,.15)',
    'Tech':'rgba(34,197,94,.15)','Other':'rgba(100,116,139,.15)'};
  var CAT_TC={'Sports':'#3b82f6','Crypto':'#f59e0b','Politics':'#ef4444',
    'Entertainment':'#a855f7','Tech':'#22c55e','Other':'#64748b'};

  // ── Layout builder ─────────────────────────────────────────────────────────
  function ensureMarketsLayout(){
    var sec=document.getElementById('v-markets');
    if(!sec||document.getElementById('mktHeader')) return;
    var mx=sec.querySelector('.mx')||sec;
    var existing=sec.querySelector('#active-markets');

    var hdr=document.createElement('div'); hdr.id='mktHeader';
    var fi=document.createElement('input');
    fi.className='mkt-fi'; fi.type='text'; fi.placeholder='Search markets...';
    fi.oninput=function(){W.fSr=this.value.trim().toLowerCase();W.renderM();};
    var sr=document.createElement('select'); sr.className='mkt-sort';
    [['newest','Newest'],['ending','Ending Soon'],['pool','Largest Pool'],['popular','Most Positions']]
      .forEach(function(o){var op=document.createElement('option');op.value=o[0];op.textContent=o[1];sr.appendChild(op);});
    sr.onchange=function(){W._htpSort=this.value;W.renderM();};
    hdr.appendChild(fi); hdr.appendChild(sr);

    var catBar=document.createElement('div'); catBar.id='mktCatBar';
    CATS.forEach(function(c){
      var b=document.createElement('button');
      b.className='mkt-cat'+(c==='All'?' act':''); b.textContent=c;
      b.onclick=function(){document.querySelectorAll('.mkt-cat').forEach(function(x){x.classList.remove('act');});this.classList.add('act');W._htpCat(c);};
      catBar.appendChild(b);
    });

    var countEl=document.createElement('span'); countEl.id='mktCount';
    hdr.appendChild(countEl);

    var grid=document.createElement('div'); grid.id='mG';
    if(existing){existing.parentNode.insertBefore(hdr,existing);existing.parentNode.insertBefore(catBar,existing);existing.id='mG';existing.parentNode.replaceChild(grid,existing);}
    else{mx.appendChild(hdr);mx.appendChild(catBar);mx.appendChild(grid);}
  }

  function buildSlider(){ /* handled by catBar buttons */ }
  function updateNavBadge(){
    var b=document.querySelector('[data-nav="markets"] .nav-badge,[onclick*="markets"] .nav-badge');
    if(b) b.textContent=getMkts().filter(function(m){return m.status==='active';}).length||'';
  }
  function updateCount(){
    var el=document.getElementById('mktCount');
    if(el){
      var n=getMkts().filter(function(m){return m.status==='active';}).length;
      el.textContent=n+' active';
    }
  }

  // ── Card renderer ──────────────────────────────────────────────────────────
  function renderCard(m){
    var yP=m.yP||50, nP=m.nP||50;
    var cat=m.category||'Other';
    var bg=CAT_COLORS[cat]||CAT_COLORS.Other;
    var tc=CAT_TC[cat]||CAT_TC.Other;
    var poolK=fmt(m.pool||0);
    var tl=timeLeft(m.closeTime||(Date.now()+86400000));
    var cover=m.img
      ?'<div class="htp-mc-cover" style="height:160px"><img class="htp-mc-cover-img" src="'+m.img+'" loading="lazy" style="width:100%;height:100%;object-fit:cover"/></div>'
      :'';
    return '<div class="mc" onclick="window.openM&&window.openM(\''+m.marketId+'\')">'
      +cover
      +'<div class="mc-inner">'
      +'<span class="mc-tag" style="background:'+bg+';color:'+tc+'">'+cat+'</span>'
      +'<div class="mc-q">'+m.question+'</div>'
      +'<div class="mc-bar-wrap"><div class="mc-bar-y" style="width:'+yP+'%"></div><div class="mc-bar-n" style="width:'+nP+'%"></div></div>'
      +'<div class="mc-odds"><span style="color:#49e8c2">Yes '+yP+'%</span><span style="color:rgba(239,68,68,.9)">No '+nP+'%</span></div>'
      +'<div class="mc-meta"><span class="mc-pool">'+poolK+' KAS</span><span>'+m.ent+' positions</span><span>'+tl+'</span></div>'
      +'</div></div>';
  }

  // ── Main render ────────────────────────────────────────────────────────────
  var _origRenderM = W.renderM;
  W.renderM = function(){
    var g=document.getElementById('mG');
    if(!g){if(_origRenderM) _origRenderM(); return;}
    var mkts=getMkts().slice(), fCat=W.fCat||'All', fSr=W.fSr||'', sort=W._htpSort||'newest';
    mkts=mkts.filter(function(m){return m.status==='active';});
    if(fCat!=='All') mkts=mkts.filter(function(m){return (m.category||'Other')===fCat;});
    if(fSr) mkts=mkts.filter(function(m){return (m.question||'').toLowerCase().indexOf(fSr)!==-1;});
    if(sort==='ending') mkts.sort(function(a,b){return (a.closeTime||0)-(b.closeTime||0);});
    else if(sort==='pool') mkts.sort(function(a,b){return (b.pool||0)-(a.pool||0);});
    else if(sort==='popular') mkts.sort(function(a,b){return (b.ent||0)-(a.ent||0);});
    else mkts.sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0);});

    if(!mkts.length){
      g.innerHTML='<div class="mkt-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>No markets found</h3><p>Try a different category or search term.</p></div>';
    } else {
      g.innerHTML=mkts.map(renderCard).join('');
    }
    updateCount();
  };

  // ── Spot / Maximizer fee disclosures ──────────────────────────────────────
  function patchFeeDisclosure(){
    W.updateFeeDisclosure=function(mode){
      var el=document.querySelector('.fee-disclosure');
      if(!el) return;
      if(mode==='maximizer'){
        el.innerHTML=
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
          +'<span style="font-weight:800;font-size:12px;color:#49e8c2">Maximizer Mode</span>'
          +'<span style="font-size:10px;padding:2px 8px;background:rgba(99,102,241,.15);color:#a78bfa;border-radius:99px;font-weight:700">SilverScript</span>'
          +'</div>'
          +'<div style="display:flex;flex-direction:column;gap:6px;font-size:12px">'
          +'<div style="display:flex;gap:10px;align-items:center">'
          +'<span style="width:36px;flex-shrink:0;font-size:10px;font-weight:800;padding:3px 0;color:#22c55e;text-align:center;background:rgba(34,197,94,.1);border-radius:5px;border:1px solid rgba(34,197,94,.2)">WIN</span>'
          +'<span style="color:#cbd5e1">Full pool payout. 2% fee on winnings only.</span>'
          +'</div>'
          +'<div style="display:flex;gap:10px;align-items:center">'
          +'<span style="width:36px;flex-shrink:0;font-size:10px;font-weight:800;padding:3px 0;color:#f59e0b;text-align:center;background:rgba(245,158,11,.1);border-radius:5px;border:1px solid rgba(245,158,11,.2)">LOSS</span>'
          +'<span style="color:#cbd5e1"><b style="color:#f1f5f9">Keep 35% of your stake.</b> Recover anytime on-chain.</span>'
          +'</div>'
          +'</div>'
          +'<div style="margin-top:7px">'
          +'<button onclick="var d=document.getElementById(\'fd-mx-detail\');d.style.display=d.style.display===\'none\'?\'\':\'none\';this.textContent=d.style.display===\'none\'?\'Read more\':\'Show less\'" style="background:none;border:none;color:#49e8c2;font-size:10px;font-weight:700;cursor:pointer;padding:0;letter-spacing:.04em">Read more</button>'
          +'<div id="fd-mx-detail" style="display:none;margin-top:7px;padding:8px 10px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.12);border-radius:8px;font-size:10px;color:#94a3b8;line-height:1.6">'
          +'On loss, 50% of your stake is locked as collateral in a SilverScript covenant on Kaspa L1. Reclaim it anytime for a 30% recovery fee, keeping 35% of your original stake. No middlemen. Always available.'
          +'</div>'
          +'</div>';
      } else {
        el.innerHTML=
          '<div style="margin-bottom:8px">'
          +'<span style="font-weight:800;font-size:12px;color:#49e8c2">Spot Mode</span>'
          +'</div>'
          +'<div style="display:flex;flex-direction:column;gap:6px;font-size:12px">'
          +'<div style="display:flex;gap:10px;align-items:center">'
          +'<span style="width:36px;flex-shrink:0;font-size:10px;font-weight:800;padding:3px 0;color:#22c55e;text-align:center;background:rgba(34,197,94,.1);border-radius:5px;border:1px solid rgba(34,197,94,.2)">WIN</span>'
          +'<span style="color:#cbd5e1">Full pool payout at current odds. 2% fee on winnings only.</span>'
          +'</div>'
          +'<div style="display:flex;gap:10px;align-items:center">'
          +'<span style="width:36px;flex-shrink:0;font-size:10px;font-weight:800;padding:3px 0;color:#ef4444;text-align:center;background:rgba(239,68,68,.1);border-radius:5px;border:1px solid rgba(239,68,68,.2)">LOSS</span>'
          +'<span style="color:#cbd5e1">Stake goes to the winning pool. Zero fees on losses.</span>'
          +'</div>'
          +'</div>'
          +'<div style="margin-top:7px">'
          +'<button onclick="var d=document.getElementById(\'fd-sp-detail\');d.style.display=d.style.display===\'none\'?\'\':\'none\';this.textContent=d.style.display===\'none\'?\'Read more\':\'Show less\'" style="background:none;border:none;color:#49e8c2;font-size:10px;font-weight:700;cursor:pointer;padding:0;letter-spacing:.04em">Read more</button>'
          +'<div id="fd-sp-detail" style="display:none;margin-top:7px;padding:8px 10px;background:rgba(73,232,194,.04);border:1px solid rgba(73,232,194,.08);border-radius:8px;font-size:10px;color:#94a3b8;line-height:1.6">'
          +'Parimutuel: all stakes pool together. Winners split the losing side pro-rata. 2% fee on winnings only. No fees on losses. Settled on Kaspa L1.'
          +'</div>'
          +'</div>';
      }
    };
    var _setMd=W.setMd;
    if(_setMd&&!_setMd._fp){
      W.setMd=function(m){_setMd.apply(this,arguments);W.updateFeeDisclosure(m);};
      W.setMd._fp=true;
    }
    setTimeout(function(){W.updateFeeDisclosure(W.tMode||'spot');},400);
  }

  W._htpCat=function(c){W.fCat=c;buildSlider();W.renderM();};
  W.setCat=W._htpCat;
  W.buildF=function(){ensureMarketsLayout();buildSlider();updateNavBadge();updateCount();};

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(){
    ensureMarketsLayout();
    patchFeeDisclosure();
    buildSlider();
    updateNavBadge();
    W.renderM();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();

  window.addEventListener('htp:markets:loaded',function(){ensureMarketsLayout();W.renderM();updateNavBadge();});
  window.addEventListener('htp:view:markets',function(){setTimeout(function(){ensureMarketsLayout();W.renderM();patchFeeDisclosure();},100);});

})(window);
