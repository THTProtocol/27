// patch-games.js - Adds Blackjack and Poker to skill games dynamically
(function(){
  function injectGames(){
    var sel = document.getElementById('sgGame');
    if (sel && !sel.querySelector('option[value="blackjack"]')) {
      var oBJ = document.createElement('option');
      oBJ.value = 'blackjack';
      oBJ.setAttribute('data-times','0|0');
      oBJ.setAttribute('data-series','1,3,5,7');
      oBJ.textContent = 'BJ Blackjack';
      sel.appendChild(oBJ);
      var oPK = document.createElement('option');
      oPK.value = 'poker';
      oPK.setAttribute('data-times','0|0');
      oPK.setAttribute('data-series','1,3,5');
      oPK.textContent = 'Poker';
      sel.appendChild(oPK);
    }
    var picker = document.getElementById('sgGamePicker');
    if (picker && !picker.querySelector('[data-game="blackjack"]')) {
      var mkBtn = function(game,icon,label){
        var b = document.createElement('button');
        b.type='button'; b.className='sg-gbtn'; b.setAttribute('data-game',game);
        b.style.cssText='padding:14px 8px;border-radius:10px;border:1px solid var(--border);background:rgba(10,15,30,0.6);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.2s;';
        b.innerHTML='<span class="sg-ico" style="color:#49e8c2;font-size:32px;font-weight:700">'+icon+'</span><span class="sg-lbl" style="font-size:11px">'+label+'</span>';
        b.addEventListener('click',function(){
          if(sel){sel.value=game; sel.dispatchEvent(new Event('change'));}
          picker.querySelectorAll('.sg-gbtn').forEach(function(x){x.classList.toggle('act',x===b);});
        });
        return b;
      };
      picker.appendChild(mkBtn('blackjack','BJ','Blackjack'));
      picker.appendChild(mkBtn('poker','PK','Poker'));
    }
    var grid = document.querySelector('.sg-grid');
    if (grid && !grid.querySelector('[data-sg="blackjack"]')) {
      var mkCard = function(game,icon,title,desc){
        var c = document.createElement('div');
        c.className='sg-card'; c.setAttribute('data-sg',game);
        c.innerHTML='<div style="font-size:32px;margin-bottom:10px;color:#49e8c2;font-weight:700">'+icon+'</div><h3>'+title+'</h3><p>'+desc+'</p>';
        c.addEventListener('click',function(){
          var btn = picker && picker.querySelector('[data-game="'+game+'"]');
          if (btn) btn.click();
          var form = document.querySelector('.match-form, #sgGamePicker');
          if (form) form.scrollIntoView({behavior:'smooth',block:'center'});
        });
        return c;
      };
      grid.appendChild(mkCard('blackjack','BJ','Blackjack','Player vs Dealer or P2P. Provably fair shuffle via on-chain commit-reveal. Hit, stand, double, split. Settled by Kaspa covenant.'));
      grid.appendChild(mkCard('poker','PK','Poker','Texas Holdem heads-up. Mental poker protocol with threshold ZK encryption. Bets escrowed by covenant. Showdown verified on-chain.'));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectGames);
  else injectGames();
  setTimeout(injectGames, 1500);
  setTimeout(injectGames, 4000);
  // Re-run when navigating to skill view
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[onclick*="skill"], [data-view="skill"], .nav-btn');
    if (t) setTimeout(injectGames, 250);
  });
})();
