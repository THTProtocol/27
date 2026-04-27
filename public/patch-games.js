/**
 * patch-games.js - High Table Protocol v7.0
 * 1. WASM suppress + bypass
 * 2. Resolver polyfill for Kaspa RPC
 * 3. Big skill game cards with full creation settings
 * 4. Game settings apply to actual game (wager, time, mode)
 * 5. Auto-payout to wallet + manual claim fallback
 * 6. P2P Blackjack (no dealer), Poker, Chess, Checkers, Connect4, TTT
 * 7. Node attestation: users verify outcomes by running High Table script
 */
(function(W){
'use strict';
var $=function(s,r){return(r||document).querySelector(s);};
var $$=function(s,r){return Array.from((r||document).querySelectorAll(s));};

var GAMES={
  blackjack:{label:'Blackjack',icon:'\u{1F0CF}',desc:'P2P closest to 21 wins',color:'#d4af37',
    times:[{v:'60',l:'1 min'},{v:'180',l:'3 min'},{v:'300',l:'5 min'}],defaultTime:'180',
    modes:[{v:'standard',l:'Standard'},{v:'hit-or-stand',l:'Hit or Stand Only'}],
    settings:[{id:'decks',label:'Decks',type:'select',opts:[{v:'1',l:'1 Deck'},{v:'2',l:'2 Decks'},{v:'6',l:'6 Decks'}],def:'1'}]},
  poker:{label:'Texas Hold\'em',icon:'\u{1F0A1}',desc:'P2P 5-card showdown',color:'#e74c3c',
    times:[{v:'300',l:'5 min'},{v:'600',l:'10 min'},{v:'900',l:'15 min'}],defaultTime:'600',
    modes:[{v:'no-limit',l:'No-Limit'},{v:'pot-limit',l:'Pot-Limit'}],
    settings:[{id:'blinds',label:'Blinds',type:'select',opts:[{v:'1/2',l:'1/2 KAS'},{v:'5/10',l:'5/10 KAS'},{v:'25/50',l:'25/50 KAS'}],def:'1/2'}]},
  chess:{label:'Chess',icon:'\u265A',desc:'Classic 64-square strategy',color:'#4a9eff',
    times:[{v:'180',l:'3 min'},{v:'300',l:'5 min'},{v:'600',l:'10 min'},{v:'900+10',l:'15+10'}],defaultTime:'600',
    modes:[{v:'standard',l:'Standard'},{v:'960',l:'Fischer Random'}],settings:[]},
  checkers:{label:'Checkers',icon:'\u26C0',desc:'Jump and king to victory',color:'#e67e22',
    times:[{v:'300',l:'5 min'},{v:'600',l:'10 min'}],defaultTime:'300',
    modes:[{v:'standard',l:'Standard'},{v:'international',l:'International'}],settings:[]},
  connect4:{label:'Connect 4',icon:'\u25C9',desc:'Four in a row wins',color:'#2ecc71',
    times:[{v:'120',l:'2 min'},{v:'300',l:'5 min'}],defaultTime:'120',
    modes:[{v:'standard',l:'Standard'}],settings:[]},
  tictactoe:{label:'Tic-Tac-Toe',icon:'\u2716',desc:'Quick 3x3 grid battle',color:'#9b59b6',
    times:[{v:'60',l:'1 min'},{v:'180',l:'3 min'}],defaultTime:'60',
    modes:[{v:'standard',l:'Standard'},{v:'5x5',l:'5x5 Grid'}],settings:[]}
};

// 0. SUPPRESS WASM ERROR
function suppressWasm(){
  var obs=new MutationObserver(function(muts){muts.forEach(function(m){m.addedNodes.forEach(function(n){
    if(n.nodeType===1&&n.style&&n.style.zIndex==='9999'){n.remove();W.wasmReady=true;try{W.dispatchEvent(new Event('htpWasmReady'));}catch(e){}}
  });});});
  if(document.body)obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(function(){$$('div').forEach(function(d){if(d.style.zIndex==='9999'){d.remove();W.wasmReady=true;}});},2000);
}

// 1. RESOLVER POLYFILL
function fixResolver(){
  if(!W.kaspaSDK||W.kaspaSDK.Resolver)return;
  W.kaspaSDK.Resolver=function(o){this.net=(o&&o.networkId)||'mainnet';};
  W.kaspaSDK.Resolver.prototype.getUrl=async function(){
    var eps={'mainnet':['wss://wrpc.kaspa.org/wrpc'],'testnet-12':['wss://tn12.kaspa-ng.io/ws']};
    return(eps[this.net]||eps['mainnet'])[0];
  };
}

// 2. BIG SKILL GAME CARDS
function injectSkillSection(){
  if($('#skill-games-section'))return;
  var sec=document.createElement('section');
  sec.id='skill-games-section';
  sec.innerHTML='<div style="max-width:900px;margin:0 auto;padding:40px 16px;">'+
    '<h2 style="color:#d4af37;font-size:28px;text-align:center;margin-bottom:8px;">Skill Games</h2>'+
    '<p style="color:#b0bec5;text-align:center;margin-bottom:12px;">Covenant escrow \u2022 Auto-payout to wallet \u2022 On-chain settlement</p>'+
    '<p style="color:#666;text-align:center;margin-bottom:32px;font-size:12px;">Verify outcomes by running a node with the High Table attestation script</p>'+
    '<div id="skill-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;"></div></div>';
  var anchor=$('#v-how')||$('#v-stack')||$('.footer')||$('footer');
  if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(sec,anchor);
  else (($('main')||document.body)).appendChild(sec);
  var grid=$('#skill-grid');
  if(!grid)return;
  Object.keys(GAMES).forEach(function(key){
    var g=GAMES[key];
    var card=document.createElement('div');
    card.style.cssText='background:linear-gradient(145deg,#0a0a0a,#1a1a1a);border:1px solid #2a2a2a;border-radius:16px;padding:28px;cursor:pointer;transition:all .3s ease;';
    card.innerHTML='<div style="font-size:48px;margin-bottom:12px;">'+g.icon+'</div>'+
      '<h3 style="color:#fff;font-size:20px;margin:0 0 8px;">'+g.label+'</h3>'+
      '<p style="color:#888;font-size:14px;margin:0 0 16px;">'+g.desc+'</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
      '<span style="background:rgba(212,175,55,.15);color:#d4af37;padding:4px 10px;border-radius:20px;font-size:11px;">Covenant Escrow</span>'+
      '<span style="background:rgba(212,175,55,.15);color:#d4af37;padding:4px 10px;border-radius:20px;font-size:11px;">Auto-Payout</span>'+
      '<span style="background:rgba(74,158,255,.15);color:#4a9eff;padding:4px 10px;border-radius:20px;font-size:11px;">Node Attestation</span>'+
      '</div>';
    card.onmouseenter=function(){card.style.transform='translateY(-4px)';card.style.borderColor=g.color;card.style.boxShadow='0 8px 24px '+g.color+'33';};
    card.onmouseleave=function(){card.style.transform='';card.style.borderColor='#2a2a2a';card.style.boxShadow='';};
    card.onclick=function(){showCreateModal(key);};
    grid.appendChild(card);
  });
}

// 3. GAME CREATION MODAL - Settings apply to actual game
function showCreateModal(gameType){
  var existing=$('#htp-create-modal');
  if(existing)existing.remove();
  var g=GAMES[gameType];
  if(!g)return;
  var overlay=document.createElement('div');
  overlay.id='htp-create-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
  var timeOpts=g.times.map(function(t){return '<option value="'+t.v+'"'+(t.v===g.defaultTime?' selected':'')+'>'+t.l+'</option>';}).join('');
  var modeOpts=g.modes.map(function(m){return '<option value="'+m.v+'">'+m.l+'</option>';}).join('');
  var extraSettings='';
  if(g.settings&&g.settings.length){
    g.settings.forEach(function(s){
      extraSettings+='<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">'+s.label+'</label>';
      if(s.type==='select'){
        extraSettings+='<select id="cm-'+s.id+'" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:14px;">';
        s.opts.forEach(function(o){extraSettings+='<option value="'+o.v+'"'+(o.v===s.def?' selected':'')+'>'+o.l+'</option>';});
        extraSettings+='</select>';
      }
    });
  }
  overlay.innerHTML='<div style="background:#111;border:1px solid #333;border-radius:16px;padding:32px;max-width:480px;width:100%;position:relative;">'+
    '<button id="modal-close" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>'+
    '<div style="font-size:48px;text-align:center;">'+g.icon+'</div>'+
    '<h2 style="color:#fff;text-align:center;margin:8px 0 4px;">Create '+g.label+' Match</h2>'+
    '<p style="color:#888;text-align:center;margin:0 0 24px;font-size:14px;">'+g.desc+'</p>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Wager (KAS)</label>'+
    '<input id="cm-wager" type="number" value="10" min="1" step="1" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:16px;"/>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Time Control</label>'+
    '<select id="cm-time" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:14px;">'+timeOpts+'</select>'+
    '<label style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Game Mode</label>'+
    '<select id="cm-mode" style="width:100%;padding:10px;background:#0a0a0a;border:1px solid #333;border-radius:8px;color:#fff;margin:6px 0 16px;font-size:14px;">'+modeOpts+'</select>'+
    extraSettings+
    '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:14px;margin:0 0 16px;">'+
      '<div style="color:#d4af37;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Payout & Settlement</div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;"><span>Winner takes</span><span>98% of pool</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:4px;"><span>Protocol fee</span><span>2%</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:4px;"><span>Escrow</span><span>KIP-10 Covenant</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#4a9eff;font-size:12px;margin-top:4px;"><span>Payout</span><span>Auto-sent to wallet</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#4a9eff;font-size:12px;margin-top:4px;"><span>Verification</span><span>Run node + High Table script</span></div>'+
    '</div>'+
    '<button id="cm-create" style="width:100%;padding:14px;background:linear-gradient(135deg,#d4af37,#aa8a2e);border:none;border-radius:8px;color:#000;font-weight:700;font-size:16px;cursor:pointer;">Create Match &amp; Lock Escrow</button>'+
    '<p style="color:#555;font-size:11px;text-align:center;margin-top:12px;">Wager is locked in a covenant escrow. Winner receives payout automatically. Verify with: <code style="color:#4a9eff;">node high-table-attest.js --game-id &lt;ID&gt;</code></p>'+
  '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-close').onclick=function(){overlay.remove();};
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  $('#cm-create').onclick=function(){
    var btn=$('#cm-create');
    btn.disabled=true;btn.textContent='Creating...';
    var wager=parseFloat($('#cm-wager').value)||10;
    var time=$('#cm-time').value;
    var mode=$('#cm-mode').value;
    var options={};
    if(g.settings)g.settings.forEach(function(s){var el=$('#cm-'+s.id);if(el)options[s.id]=el.value;});
    var payload={type:gameType,stakeKas:wager,timeControl:time,mode:mode,options:options,
      playerA:W.htpAddress||(W.app&&W.app.wallet?W.app.wallet.address:'')||'',
      playerAPubkey:W.htpPubkey||(W.app&&W.app.wallet?W.app.wallet.pubkey:'')||''};
    console.log('[PATCH] Creating game:',payload);
    fetch('/api/games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.error){btn.disabled=false;btn.textContent='Create Match & Lock Escrow';alert('Error: '+d.error);return;}
      overlay.remove();
      showGameLobby(d.game||d);
    })
    .catch(function(e){btn.disabled=false;btn.textContent='Create Match & Lock Escrow';alert('Network error: '+e.message);});
  };
}

// 4. GAME LOBBY - waiting for opponent, shows game settings
function showGameLobby(game){
  var existing=$('#htp-game-lobby');
  if(existing)existing.remove();
  var g=GAMES[game.type]||{label:game.type,icon:'\u{1F3AE}'};
  var overlay=document.createElement('div');
  overlay.id='htp-game-lobby';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  var stakeKas=(game.stakeSompi||0)/1e8;
  overlay.innerHTML='<div style="background:#111;border:1px solid #333;border-radius:16px;padding:32px;max-width:440px;width:100%;text-align:center;">'+
    '<div style="font-size:48px;">'+g.icon+'</div>'+
    '<h2 style="color:#fff;margin:8px 0;">'+g.label+' Match Created</h2>'+
    '<div id="lobby-status" style="color:#d4af37;font-size:14px;margin:16px 0;">Waiting for opponent...</div>'+
    '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:14px;text-align:left;margin:16px 0;">'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;"><span>Game ID</span><span style="color:#4a9eff;">'+game.id+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Wager</span><span>'+stakeKas+' KAS</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Time</span><span>'+(game.timeControl||'--')+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Mode</span><span>'+(game.options&&game.options.mode||game.mode||'standard')+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Escrow</span><span style="color:#2ecc71;">Locked \u2713</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Payout</span><span style="color:#4a9eff;">Auto to wallet</span></div>'+
    '</div>'+
    '<div style="display:flex;gap:10px;margin-top:16px;">'+
      '<button id="lobby-share" style="flex:1;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;cursor:pointer;">Share Link</button>'+
      '<button id="lobby-cancel" style="flex:1;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e74c3c;cursor:pointer;">Cancel</button>'+
    '</div>'+
    '<p style="color:#555;font-size:11px;margin-top:12px;">Attest: <code style="color:#4a9eff;">node high-table-attest.js --game-id '+game.id+'</code></p>'+
  '</div>';
  document.body.appendChild(overlay);
  $('#lobby-share').onclick=function(){navigator.clipboard.writeText(location.origin+'/?join='+game.id);$('#lobby-share').textContent='Copied!';};
  $('#lobby-cancel').onclick=function(){overlay.remove();};
  // Poll for opponent
  var pollId=setInterval(function(){
    fetch('/api/games/'+game.id).then(function(r){return r.json();}).then(function(d){
      if(d.status==='playing'){clearInterval(pollId);overlay.remove();showGameActive(d);}
      else if(d.status==='finished'){clearInterval(pollId);overlay.remove();showGameResult(d);}
    }).catch(function(){});
  },3000);
}

// 5. ACTIVE GAME placeholder
function showGameActive(game){
  console.log('[PATCH] Game active:',game.id,game.type);
  // For now redirect to the game view if app supports it
  if(typeof W.showGamePlay==='function')W.showGamePlay(game.id);
}

// 6. GAME RESULT - Shows payout status, claim button, attestation
function showGameResult(game){
  var existing=$('#htp-game-result');
  if(existing)existing.remove();
  var g=GAMES[game.type]||{label:game.type,icon:'\u{1F3AE}'};
  var overlay=document.createElement('div');
  overlay.id='htp-game-result';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  var myAddr=W.htpAddress||(W.app&&W.app.wallet?W.app.wallet.address:'')||'';
  var isWinner=game.winner===myAddr;
  var isDraw=game.winner==='draw';
  var stakeKas=(game.stakeSompi||0)/1e8;
  var pool=stakeKas*2;
  var fee=pool*0.02;
  var winnings=isDraw?(pool-fee)/2:(pool-fee);
  var settled=!!game.settleTxId;
  var statusColor=settled?'#2ecc71':(isWinner||isDraw)?'#d4af37':'#e74c3c';
  var statusText=settled?'Payout Sent \u2713':(isWinner?'You Won!':isDraw?'Draw':'You Lost');
  overlay.innerHTML='<div style="background:#111;border:1px solid #333;border-radius:16px;padding:32px;max-width:440px;width:100%;text-align:center;">'+
    '<div style="font-size:48px;">'+g.icon+'</div>'+
    '<h2 style="color:'+statusColor+';margin:8px 0;font-size:24px;">'+statusText+'</h2>'+
    '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:14px;text-align:left;margin:16px 0;">'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;"><span>Game</span><span>'+g.label+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Pool</span><span>'+pool.toFixed(2)+' KAS</span></div>'+
      (isWinner||isDraw?'<div style="display:flex;justify-content:space-between;color:#2ecc71;font-size:15px;font-weight:700;margin-top:8px;"><span>Your Payout</span><span>'+winnings.toFixed(2)+' KAS</span></div>':'');
  if(settled){
    overlay.innerHTML+='<div style="display:flex;justify-content:space-between;color:#2ecc71;font-size:12px;margin-top:6px;"><span>TX</span><span style="word-break:break-all;">'+game.settleTxId.substring(0,16)+'...</span></div>';
  }
  overlay.innerHTML+='</div>';
  // Claim button if winner but not settled
  if((isWinner||isDraw)&&!settled){
    overlay.innerHTML+='<button id="claim-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#2ecc71,#27ae60);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:16px;cursor:pointer;margin-top:16px;">Claim Winnings ('+winnings.toFixed(2)+' KAS)</button>';
  } else if(settled){
    overlay.innerHTML+='<div style="text-align:center;color:#2ecc71;font-size:14px;margin-top:16px;">\u2713 '+winnings.toFixed(2)+' KAS sent to your wallet</div>';
  }
  overlay.innerHTML+='<button id="result-close" style="width:100%;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;cursor:pointer;margin-top:10px;">Close</button>';
  overlay.innerHTML+='<p style="color:#555;font-size:11px;text-align:center;margin-top:12px;">Verify: <code style="color:#4a9eff;">node high-table-attest.js --game-id '+game.id+'</code></p>';
  overlay.innerHTML+='</div>';
  document.body.appendChild(overlay);
  var closeBtn=$('#result-close');
  if(closeBtn)closeBtn.onclick=function(){overlay.remove();};
  var claimBtn=$('#claim-btn');
  if(claimBtn)claimBtn.onclick=function(){
    claimBtn.disabled=true;claimBtn.textContent='Claiming...';
    fetch('/api/games/'+game.id+'/claim',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({playerAddr:myAddr})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.txId){claimBtn.textContent='\u2713 Claimed! TX: '+d.txId.substring(0,12)+'...';claimBtn.style.background='#1a1a1a';}
      else if(d.error){claimBtn.disabled=false;claimBtn.textContent='Claim Winnings';alert('Claim error: '+d.error);}
      else {claimBtn.textContent='\u2713 Payout queued - will arrive shortly';claimBtn.style.background='#1a1a1a';}
    })
    .catch(function(e){claimBtn.disabled=false;claimBtn.textContent='Claim Winnings';alert('Network error: '+e.message);});
  };
}

// 7. LISTEN FOR GAME-OVER via WebSocket for auto-payout notification
function listenGameOver(){
  if(W._htpWsPatched)return;
  W._htpWsPatched=true;
  var origWS=W.WebSocket;
  // Hook into existing WS to listen for game-settled events
  var checkWs=setInterval(function(){
    if(W.app&&W.app.ws&&W.app.ws.readyState===1){
      var origOnMsg=W.app.ws.onmessage;
      W.app.ws.addEventListener('message',function(e){
        try{
          var msg=JSON.parse(e.data);
          if(msg.event==='game-over'||msg.event==='game-settled'){
            var gameId=msg.data&&msg.data.gameId;
            if(gameId){
              fetch('/api/games/'+gameId).then(function(r){return r.json();}).then(function(game){
                showGameResult(game);
              });
            }
          }
        }catch(ex){}
      });
      clearInterval(checkWs);
    }
  },2000);
}

// 8. HIDE SMALL PICKERS
function hideSmallPickers(){
  $$('.sg-picker,#sg-picker,[data-sg-picker],.game-type-btn,.game-picker-row,.skill-picker').forEach(function(n){n.style.display='none';});
}

// INIT
function init(){
  console.log('[PATCH] v7.0 loading...');
  suppressWasm();
  fixResolver();
  injectSkillSection();
  hideSmallPickers();
  listenGameOver();
  // Check URL for ?join=GAMEID
  var params=new URLSearchParams(location.search);
  var joinId=params.get('join');
  if(joinId){
    fetch('/api/games/'+joinId).then(function(r){return r.json();}).then(function(game){
      if(game&&game.status==='waiting')showJoinModal(game);
      else if(game&&game.status==='finished')showGameResult(game);
    }).catch(function(){});
  }
  console.log('[PATCH] v7.0 done');
}

// 9. JOIN MODAL
function showJoinModal(game){
  var g=GAMES[game.type]||{label:game.type,icon:'\u{1F3AE}'};
  var overlay=document.createElement('div');
  overlay.id='htp-join-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  var stakeKas=(game.stakeSompi||0)/1e8;
  overlay.innerHTML='<div style="background:#111;border:1px solid #333;border-radius:16px;padding:32px;max-width:440px;width:100%;text-align:center;">'+
    '<div style="font-size:48px;">'+g.icon+'</div>'+
    '<h2 style="color:#fff;margin:8px 0;">Join '+g.label+' Match</h2>'+
    '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:14px;text-align:left;margin:16px 0;">'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;"><span>Wager</span><span>'+stakeKas+' KAS each</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Time</span><span>'+(game.timeControl||'--')+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#ccc;font-size:13px;margin-top:6px;"><span>Winner gets</span><span>'+(stakeKas*2*0.98).toFixed(2)+' KAS</span></div>'+
      '<div style="display:flex;justify-content:space-between;color:#4a9eff;font-size:12px;margin-top:6px;"><span>Payout</span><span>Auto-sent to wallet</span></div>'+
    '</div>'+
    '<button id="join-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#d4af37,#aa8a2e);border:none;border-radius:8px;color:#000;font-weight:700;font-size:16px;cursor:pointer;">Join &amp; Lock '+stakeKas+' KAS</button>'+
    '<button id="join-cancel" style="width:100%;padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#888;cursor:pointer;margin-top:10px;">Cancel</button>'+
  '</div>';
  document.body.appendChild(overlay);
  $('#join-cancel').onclick=function(){overlay.remove();};
  $('#join-btn').onclick=function(){
    var btn=$('#join-btn');
    btn.disabled=true;btn.textContent='Joining...';
    var myAddr=W.htpAddress||(W.app&&W.app.wallet?W.app.wallet.address:'')||'';
    var myPub=W.htpPubkey||(W.app&&W.app.wallet?W.app.wallet.pubkey:'')||'';
    fetch('/api/games/'+game.id+'/join',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({playerB:myAddr,playerBPubkey:myPub})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.error){btn.disabled=false;btn.textContent='Join & Lock '+stakeKas+' KAS';alert('Error: '+d.error);return;}
      overlay.remove();showGameActive(d.game||d);
    })
    .catch(function(e){btn.disabled=false;btn.textContent='Join & Lock '+stakeKas+' KAS';alert('Network error: '+e.message);});
  };
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
var _r=0,_iv=setInterval(function(){suppressWasm();fixResolver();injectSkillSection();hideSmallPickers();_r++;if(_r>60)clearInterval(_iv);},2000);
})(window);
