// patch-games.js - Big-card-only Skill Games entry point with per-game settings
(function(){
  function $(s, r){ return (r||document).querySelector(s); }
  function $all(s, r){ return Array.from((r||document).querySelectorAll(s)); }

  var GAMES = {
    chess:      { label:'Chess',       icon:'♞', times:[1,3,5,10,15,30], modes:['Standard','Blitz','Bullet','Rapid'], stake:[1,5,10,25,50,100] },
    connect4:   { label:'Connect 4',   icon:'●', times:[1,3,5,10],         modes:['Standard','Speed'],                    stake:[1,5,10,25,50] },
    checkers:   { label:'Checkers',    icon:'⛂', times:[3,5,10,15],        modes:['Standard','Flying Kings'],              stake:[1,5,10,25,50] },
    tictactoe:  { label:'Tic-Tac-Toe', icon:'✕',  times:[1,3,5],            modes:['Classic','Ultimate'],                   stake:[1,5,10] },
    blackjack:  { label:'Blackjack',   icon:'BJ', times:[5,10,15,30],  modes:['Classic','Vegas','European'],           stake:[5,10,25,50,100,250] },
    poker:      { label:'Poker',       icon:'♠',  times:[10,15,30,60],     modes:["Texas Hold em",'Omaha','7-Card Stud'],  stake:[5,10,25,50,100,250,500] }
  };

  function hidePicker(){
    $all('.sg-picker, #sg-picker, [data-sg-picker]').forEach(function(n){ n.style.display='none'; });
  }

  function ensureBigCards(){
    var grid = $('#skill-grid') || $('.skill-grid') || $('.sg-grid') || $('#sg-grid');
    if (!grid){
      var section = $('#skill') || $('#skill-games') || $('[data-section="skill"]');
      if (!section) return null;
      grid = document.createElement('div');
      grid.id = 'skill-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:16px;';
      section.appendChild(grid);
    }
    Object.keys(GAMES).forEach(function(key){
      if (grid.querySelector('[data-game="'+key+'"]')) return;
      var g = GAMES[key];
      var card = document.createElement('button');
      card.type='button';
      card.className='sg-card';
      card.setAttribute('data-game', key);
      card.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;border-radius:14px;border:1px solid #2a2a2a;background:linear-gradient(160deg,#141414,#0a0a0a);color:#fff;cursor:pointer;font:600 16px/1.2 system-ui,sans-serif;transition:transform .15s,border-color .15s;';
      card.innerHTML='<div style="font-size:48px;margin-bottom:10px">'+g.icon+'</div><div>'+g.label+'</div>';
      card.addEventListener('mouseenter',function(){card.style.transform='translateY(-2px)';card.style.borderColor='#d4af37';});
      card.addEventListener('mouseleave',function(){card.style.transform='';card.style.borderColor='#2a2a2a';});
      card.addEventListener('click',function(){ openCreate(key); });
      grid.appendChild(card);
    });
    return grid;
  }

  function openCreate(key){
    var g = GAMES[key]; if(!g) return;
    var old = $('#sg-modal'); if (old) old.remove();
    var modal = document.createElement('div');
    modal.id='sg-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var card = document.createElement('div');
    card.style.cssText='background:#0d0d0d;border:1px solid #d4af37;border-radius:14px;padding:24px;min-width:340px;max-width:480px;color:#fff;font:14px system-ui,sans-serif;';
    function opts(arr){ return arr.map(function(v){return '<option value="'+v+'">'+v+'</option>';}).join(''); }
    card.innerHTML =
      '<h2 style="margin:0 0 12px;font-size:22px;color:#d4af37">Create '+g.label+' Match</h2>'+
      '<label style="display:block;margin:10px 0 4px">Time (minutes)</label>'+
      '<select id="sg-time" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:8px">'+opts(g.times)+'</select>'+
      '<label style="display:block;margin:10px 0 4px">Mode</label>'+
      '<select id="sg-mode" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:8px">'+opts(g.modes)+'</select>'+
      '<label style="display:block;margin:10px 0 4px">Stake (USD)</label>'+
      '<select id="sg-stake" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:8px">'+opts(g.stake)+'</select>'+
      '<label style="display:block;margin:10px 0 4px">Visibility</label>'+
      '<select id="sg-vis" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:8px"><option>Public</option><option>Private</option></select>'+
      '<div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">'+
        '<button id="sg-cancel" style="padding:10px 16px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;cursor:pointer">Cancel</button>'+
        '<button id="sg-create" style="padding:10px 16px;border-radius:8px;border:1px solid #d4af37;background:#d4af37;color:#000;font-weight:700;cursor:pointer">Create Match</button>'+
      '</div>';
    modal.appendChild(card);
    document.body.appendChild(modal);
    $('#sg-cancel').onclick = function(){ modal.remove(); };
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
    $('#sg-create').onclick = function(){
      var payload = { game:key, time:$('#sg-time').value, mode:$('#sg-mode').value, stake:$('#sg-stake').value, visibility:$('#sg-vis').value };
      try { window.dispatchEvent(new CustomEvent('sg:create', { detail: payload })); } catch(e){}
      console.log('[SG] create', payload);
      modal.remove();
    };
  }

  function run(){ hidePicker(); ensureBigCards(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  setInterval(function(){ hidePicker(); ensureBigCards(); }, 1500);
})();
