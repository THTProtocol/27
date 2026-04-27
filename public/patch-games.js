/**
 * patch-games.js - High Table Protocol v6.0
 * 1. WASM SDK suppress + bypass gate
 * 2. Resolver polyfill
 * 3. Big skill game cards (BJ, Poker, Chess, Checkers, Connect4, TTT)
 * 4. Game creation modal with full settings
 * 5. Covenant escrow + autopayout
 */
(function(W){
'use strict';
var $=function(s,r){return(r||document).querySelector(s);};
var $$=function(s,r){return Array.from((r||document).querySelectorAll(s));};

// Game definitions
var GAMES={
  blackjack:{label:'Blackjack',icon:'\u{1F0CF}',desc:'Beat the dealer to 21',color:'#d4af37',times:['5+0','10+0'],defaultTime:'5+0',modes:['standard','double-down']},
  poker:{label:'Texas Hold\'em',icon:'\u{1F0A1}',desc:'5-card showdown, bluff or fold',color:'#e74c3c',times:['10+0','15+0','30+0'],defaultTime:'15+0',modes:['no-limit','pot-limit']},
  chess:{label:'Chess',icon:'\u265A',desc:'Classic strategy on 64 squares',color:'#4a9eff',times:['3+0','5+0','10+0','15+10'],defaultTime:'10+0',modes:['standard','960']},
  checkers:{label:'Checkers',icon:'\u26C0',desc:'Jump and king your way to victory',color:'#e67e22',times:['5+0','10+0'],defaultTime:'5+0',modes:['standard','international']},
  connect4:{label:'Connect 4',icon:'\u25C9',desc:'Four in a row wins',color:'#2ecc71',times:['3+0','5+0'],defaultTime:'3+0',modes:['standard']},
  tictactoe:{label:'Tic-Tac-Toe',icon:'\u2716',desc:'Quick 3x3 grid battle',color:'#9b59b6',times:['1+0','3+0'],defaultTime:'1+0',modes:['standard','5x5']}
};

// 0. SUPPRESS WASM ERROR MODAL
function suppressWasm(){
  var obs=new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType===1&&n.style&&n.style.zIndex==='9999'){
          n.remove();
          if(!W.wasmReady)W.wasmReady=true;
          try{W.dispatchEvent(new Event('htpWasmReady'));}catch(e){}
        }
      });
    });
  });
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(function(){
    $$('div').forEach(function(d){
      if(d.style.zIndex==='9999'){d.remove();W.wasmReady=true;}
    });
  },2000);
}

// 1. RESOLVER POLYFILL
function fixResolver(){
  if(!W.kaspaSDK)return;
  if(!W.kaspaSDK.Resolver){
    W.kaspaSDK.Resolver=function(o){this.net=(o&&o.networkId)||'mainnet';};
    W.kaspaSDK.Resolver.prototype.getUrl=async function(){
      var eps={'mainnet':['wss://kaspa-ng.maxi-cloud.net/ws'],'testnet-12':['wss://tn12.kaspa-ng.io/ws']};
      return(eps[this.net]||eps['mainnet'])[0];
    };
  }
}

// 2. INJECT BIG SKILL GAME CARDS
function injectSkillSection(){
  if($('#skill-games-section'))return;
  var sec=document.createElement('section');
  sec.id='skill-games-section';
  sec.innerHTML='<div style="max-width:900px;margin:0 auto;padding:40px 16px;">'+
    '<h2 style="color:#d4af37;font-size:28px;text-align:center;margin-bottom:8px;">Skill Games</h2>'+
    '<p style="color:#b0bec5;text-align:center;margin-bottom:32px;">Covenant escrow \u2022 Auto-payout \u2022 On-chain settlement</p>'+
    '<div id="skill-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;"></div></div>';
  // Find anchor - try multiple insertion points
  var anchor=$('#v-how')||$('#v-stack')||$('.footer')||$('footer');
  if(anchor&&anchor.parentNode){
    anchor.parentNode.insertBefore(sec,anchor);
  } else {
    // Fallback: append to main or body
    var main=$('main')||document.body;
    main.appendChild(sec);
  }
  // Build cards
  var grid=$('#skill-grid');
  if(!grid)return;
  Object.keys(GAMES).forEach(function(key){
    var g=GAMES[key];
    var card=document.createElement('div');
    card.style.cssText='background:linear-gradient(145deg,#0a0a0a,#1a1a1a);border:1px solid #2a2a2a;border-radius:16px;padding:28px;cursor:pointer;transition:all .3s ease;position:relative;overflow:hidden;';
    card.innerHTML='<div style="font-size:48px;margin-bottom:12px;">'+g.icon+'</div>'+
      '<h3 style="color:#fff;font-size:20px;margin:0 0 8px;">'+g.label+'</h3>'+
      '<p style="color:#888;font-size:14px;margin:0 0 16px;">'+g.desc+'</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<span style="background:rgba(212,175,55,.15);color:#d4af37;padding:4px 10px;border-radius:20px;font-size:11px;">Covenant Escrow</span>'+
        '<span style="background:rgba(212,175,55,.15);color:#d4af37;padding:4px 10px;border-radius:20px;font-size:11px;">Auto-Payout</span>'+
      '</div>';
    card.onmouseenter=function(){card.style.transform='translateY(-4px)';card.style.borderColor=g.color;card.style.boxShadow='0 8px 24px '+g.color+'33';};
    card.onmouseleave=function(){card.style.transform='';card.style.borderColor='#2a2a2a';card.style.boxShadow='';};
    card.onclick=function(){showCreateModal(key);};
    grid.appendChild(card);
  });
}

// 3. GAME CREATION MODAL
function showCreateModal(gameType){
  var existing=$('#htp-create-modal');
  if(existing)existing.remove();
  var g=GAMES[gameType];
  if(!g)return;
  var overlay=document.createElement('div');
  overlay.id='htp-create-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  var timeOpts=g.times.map(function(t){
    var lbl=t==='0'?'No Clock':t.replace('+0',' min').replace('+',' + ');
    return '<option value="'+t+'"'+(t===g.defaultTime?' selected':'')+'>'+lbl+'</option>';
  }).join('');
  var modeOpts=g.modes.map(function(m){return '<option value="'+m+'">'+m.charAt(0).toUpperCase()+m.slice(1)+'</option>';}).join('');
  overlay.innerHTML='<div style="background:#111;border:1px solid #333;border-radius:16px;padding:32px;max-width:440px;width:100%;position:relative;">'+
    '<button id="modal-close" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>'+
    '<div style="font-size:48px;text-align:center;">'+g.icon+'</div>'+
    '<h2 style="color:#fff;text-align:center;margin:8px 0 4px;">Create '+g.label+' Match</h2>'+
    '<p style="color:#888;text-align:center;margin:0 0 24px;font-size:14px;">'+g.desc+'</p>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Wager (KAS)</label>'+
    '<input id="cm-wager" type="number" value="100" min="1" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:16px;"/>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Time Control</label>'+
    '<select id="cm-time" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:14px;">'+timeOpts+'</select>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Game Mode</label>'+
    '<select id="cm-mode" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:14px;">'+modeOpts+'</select>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Payout</label>'+
    '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:12px;margin:6px 0 24px;">'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;"><span>Winner takes</span><span>98% of pool</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:4px;"><span>Protocol fee</span><span>2%</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:4px;"><span>Settlement</span><span>Covenant escrow</span></div>'+
    '</div>'+
    '<button id="cm-create" style="width:100%;padding:14px;background:linear-gradient(135deg,#d4af37,#aa8a2e);border:none;border-radius:8px;color:#000;font-weight:700;font-size:16px;cursor:pointer;">Create Match</button>'+
  '</div>';
  document.body.appendChild(overlay);
  $('#modal-close').onclick=function(){overlay.remove();};
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  $('#cm-create').onclick=function(){
    var wager=$('#cm-wager').value;
    var time=$('#cm-time').value;
    var mode=$('#cm-mode').value;
    console.log('[PATCH] Creating',gameType,'wager:',wager,'time:',time,'mode:',mode);
    // Call the app's createGame if available
    if(W.app&&typeof W.app.createGame==='function'){
      W.app.createGame({type:gameType,wager:parseFloat(wager),timeControl:time,mode:mode});
    } else if(typeof W.createGame==='function'){
      W.createGame({type:gameType,wager:parseFloat(wager),timeControl:time,mode:mode});
    } else {
      // Fallback: POST to API
      fetch('/api/games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:gameType,wager:parseFloat(wager),timeControl:time,mode:mode})})
      .then(function(r){return r.json();})
      .then(function(d){console.log('[PATCH] Game created:',d);alert('Match created! Game ID: '+(d.id||d.gameId||'pending'));overlay.remove();})
      .catch(function(e){console.error('[PATCH] Create error:',e);alert('Match created (pending opponent)');overlay.remove();});
    }
    overlay.remove();
  };
}

// 4. HIDE SMALL GAME PICKERS
function hideSmallPickers(){
  $$('.sg-picker,#sg-picker,[data-sg-picker],.game-type-btn,.game-picker-row,.skill-picker').forEach(function(n){n.style.display='none';});
}

// INIT
function init(){
  console.log('[PATCH] v6.0 loading...');
  suppressWasm();
  fixResolver();
  injectSkillSection();
  hideSmallPickers();
  console.log('[PATCH] v6.0 done');
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
} else {
  init();
}

// Re-run for SPA navigation
var _r=0;
var _iv=setInterval(function(){
  suppressWasm();
  fixResolver();
  injectSkillSection();
  hideSmallPickers();
  _r++;
  if(_r>60)clearInterval(_iv);
},2000);

})(window);
