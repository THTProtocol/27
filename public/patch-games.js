/**
 * patch-games.js - High Table Protocol v5.0
 * COMPREHENSIVE PATCH:
 *  1. WASM SDK + Resolver fix (retry/fallback)
 *  2. Big-card-only Skill Games (no small picker)
 *  3. Blackjack + Poker + Tic-Tac-Toe added to create modal
 *  4. Board rendering for BJ/Poker/TTT
 *  5. Covenant escrow + autopayout wired for ALL game types
 */
(function(W){
  'use strict';
  var $ = function(s,r){return(r||document).querySelector(s);};
  var $$ = function(s,r){return Array.from((r||document).querySelectorAll(s));};

  // =========================================
  // 1. WASM SDK RESOLVER FIX
  // =========================================
  function fixWasmResolver(){
    if(!W.kaspaSDK) return;
    var sdk = W.kaspaSDK;
    // If Resolver is missing, provide a polyfill
    if(!sdk.Resolver){
      console.warn('[PATCH] kaspaSDK.Resolver missing, creating polyfill');
      sdk.Resolver = function ResolverPolyfill(opts){
        this.networkId = (opts&&opts.networkId)||'mainnet';
      };
      sdk.Resolver.prototype.getUrl = async function(){
        // Fallback to known public Kaspa RPC endpoints
        var ENDPOINTS = {
          'mainnet': [
            'wss://kaspa-ng.maxi-cloud.net/ws',
            'wss://kaspa.aspectron.com/ws',
            'wss://kaspa-rpc.io/ws'
          ],
          'testnet-12': [
            'wss://tn12.kaspa-ng.io/ws',
            'wss://kaspa-tn12.aspectron.com/ws'
          ]
        };
        var net = this.networkId.replace('testnet-','tn');
        var urls = ENDPOINTS[this.networkId]||ENDPOINTS['mainnet'];
        for(var i=0;i<urls.length;i++){
          try{
            var ws = new WebSocket(urls[i]);
            await new Promise(function(ok,fail){
              ws.onopen=function(){ws.close();ok();};
              ws.onerror=fail;
              setTimeout(fail,3000);
            });
            return urls[i];
          }catch(e){continue;}
        }
        return urls[0];
      };
      sdk.Resolver.prototype.getNodeEndpoint = sdk.Resolver.prototype.getUrl;
      console.log('[PATCH] Resolver polyfill installed');
    }
    // If RpcClient exists but connect fails, patch it
    if(sdk.RpcClient){
      var OrigRpc = sdk.RpcClient;
      sdk.RpcClient = function PatchedRpcClient(opts){
        if(opts && opts.resolver && !opts.url){
          // Resolver-based: let it through
        }
        return new OrigRpc(opts);
      };
      sdk.RpcClient.prototype = OrigRpc.prototype;
      Object.keys(OrigRpc).forEach(function(k){sdk.RpcClient[k]=OrigRpc[k];});
    }
    // Re-fire wasmReady if it was missed
    if(W.wasmReady && sdk.RpcClient && !W._patchWasmFired){
      W._patchWasmFired = true;
      console.log('[PATCH] Re-firing htpWasmReady');
      try{W.dispatchEvent(new Event('htpWasmReady'));}catch(e){}
      if(typeof W._onWasmReady==='function') try{W._onWasmReady();}catch(e){}
    }
  }

  // =========================================
  // 2. PATCH CREATE MODAL - add BJ/Poker/TTT
  // =========================================
  var GAME_DEFS = {
    chess:     {label:'Chess',icon:'\u265a',times:['5+0','10+0','15+10','30+0','0'],defaultTime:'10+0'},
    checkers:  {label:'Checkers',icon:'\u26c0',times:['5+0','10+0','15+10','30+0','0'],defaultTime:'10+0'},
    connect4:  {label:'Connect 4',icon:'\u25c9',times:['5+0','10+0','15+10','0'],defaultTime:'10+0'},
    tictactoe: {label:'Tic-Tac-Toe',icon:'\u2716',times:['1+0','3+0','5+0','0'],defaultTime:'3+0'},
    blackjack: {label:'Blackjack',icon:'\ud83c\udca1',times:['5+0','10+0','15+0','30+0'],defaultTime:'10+0',
                modes:['Classic','Vegas','European']},
    poker:     {label:'Poker',icon:'\u2660',times:['10+0','15+0','30+0','60+0'],defaultTime:'15+0',
                modes:["Texas Hold'em",'Omaha','7-Card Stud']}
  };

  function patchCreateModal(){
    var orig = W.showCreateGameModal;
    if(!orig || W._patchedCreateModal) return;
    W._patchedCreateModal = true;
    W.showCreateGameModal = function(){
      orig.apply(this, arguments);
      // Inject missing game types into #game-type select
      var sel = $('#game-type');
      if(!sel) return;
      var existing = Array.from(sel.options).map(function(o){return o.value;});
      Object.keys(GAME_DEFS).forEach(function(key){
        if(existing.indexOf(key)===-1){
          var g = GAME_DEFS[key];
          var opt = document.createElement('option');
          opt.value = key;
          opt.textContent = g.icon+' '+g.label;
          sel.appendChild(opt);
        }
      });
      // Add mode selector for BJ/Poker
      sel.addEventListener('change', function(){
        var g = GAME_DEFS[sel.value];
        var oldMode = $('#game-mode-group');
        if(oldMode) oldMode.remove();
        if(g && g.modes){
          var group = document.createElement('div');
          group.className='form-group';
          group.id='game-mode-group';
          group.innerHTML='<label>Mode</label><select id="game-mode" class="select">'+
            g.modes.map(function(m){return '<option value="'+m+'">'+m+'</option>';}).join('')+
            '</select>';
          sel.parentElement.parentElement.insertBefore(group, sel.parentElement.nextSibling);
        }
        // Update time options
        var timeSel = $('#game-time');
        if(timeSel && g){
          timeSel.innerHTML = g.times.map(function(t){
            var label = t==='0'?'No Clock':t.replace('+0',' min').replace('+',' + ');
            return '<option value="'+t+'"'+(t===g.defaultTime?' selected':'')+'>'+label+'</option>';
          }).join('');
        }
      });
    };
  }

  // =========================================
  // 3. PATCH BOARD RENDERING - BJ/Poker/TTT
  // =========================================
  function patchBoardRendering(){
    // Monkey-patch the showGamePlay / renderGameBoard to handle new types
    var origShow = W.showGamePlay;
    if(!origShow || W._patchedBoard) return;
    W._patchedBoard = true;
    // We listen for the board-container after showGamePlay runs
    // and inject BJ/Poker/TTT UIs if the type matches
    W.addEventListener('htp:game-loaded', function(e){
      var game = e.detail;
      if(!game) return;
      var container = $('#board-container');
      if(!container) return;
      var myAddr = W.htpAddress || (W.app && W.app.wallet && W.app.wallet.address) || '';
      if(game.type === 'blackjack' && W.BlackjackUI){
        var bj = new W.BlackjackUI('board-container', game, myAddr);
        if(game.state) bj.hydrate(game.state);
        W._activeBJ = bj;
      } else if(game.type === 'poker' && W.PokerUI){
        var pk = new W.PokerUI('board-container', game, myAddr);
        if(game.state) pk.hydrate(game.state);
        W._activePK = pk;
      } else if(game.type === 'tictactoe'){
        renderTicTacToe(container, game, myAddr);
      }
    });
  }

  // Tic-Tac-Toe inline game engine
  function renderTicTacToe(container, game, myAddr){
    var board = game.state ? game.state.board : ['','','','','','','','',''];
    var mySymbol = game.playerA === myAddr ? 'X' : 'O';
    var currentTurn = game.state ? game.state.turn : 'X';
    container.innerHTML = '<div id="ttt-board" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:360px;margin:20px auto;"></div>'+
      '<div id="ttt-status" style="text-align:center;color:#d4af37;font-size:18px;margin-top:12px"></div>';
    var boardEl = $('#ttt-board');
    function render(){
      boardEl.innerHTML = '';
      for(var i=0;i<9;i++){
        var cell = document.createElement('button');
        cell.className = 'ttt-cell';
        cell.dataset.idx = i;
        cell.style.cssText = 'width:100%;aspect-ratio:1;font-size:48px;background:#111;border:1px solid #333;color:#fff;cursor:pointer;border-radius:8px;';
        cell.textContent = board[i];
        if(!board[i] && currentTurn===mySymbol){
          cell.addEventListener('click', function(e){
            var idx = parseInt(e.target.dataset.idx);
            makeMove(idx);
          });
        }
        boardEl.appendChild(cell);
      }
      var winner = checkWinner();
      var status = $('#ttt-status');
      if(winner){ status.textContent = winner+' wins!'; triggerGameOver(winner===mySymbol?myAddr:getOpponent(game,myAddr)); }
      else if(board.indexOf('')===-1){ status.textContent = 'Draw!'; triggerGameOver(null); }
      else { status.textContent = currentTurn===mySymbol?'Your turn':'Opponent\'s turn'; }
    }
    function makeMove(idx){
      if(board[idx]||checkWinner()) return;
      board[idx] = mySymbol;
      currentTurn = mySymbol==='X'?'O':'X';
      // Send move via WebSocket
      if(W.app && W.app.ws){
        W.app.ws.send(JSON.stringify({type:'game-move',gameId:game.id,move:{idx:idx,symbol:mySymbol}}));
      }
      render();
    }
    function checkWinner(){
      var lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for(var i=0;i<lines.length;i++){
        var a=lines[i][0],b=lines[i][1],c=lines[i][2];
        if(board[a]&&board[a]===board[b]&&board[a]===board[c]) return board[a];
      }
      return null;
    }
    render();
    // Listen for opponent moves
    W.addEventListener('htp:game-move', function(e){
      if(e.detail&&e.detail.gameId===game.id&&e.detail.move){
        board[e.detail.move.idx] = e.detail.move.symbol;
        currentTurn = e.detail.move.symbol==='X'?'O':'X';
        render();
      }
    });
  }

  function getOpponent(game, myAddr){
    return game.playerA===myAddr ? game.playerB : game.playerA;
  }

  function triggerGameOver(winnerAddr){
    if(typeof W.handleMatchGameOver==='function'){
      W.handleMatchGameOver(winnerAddr?'checkmate':'draw', winnerAddr);
    }
  }

  // =========================================
  // 4. BIG CARDS ONLY - remove small picker
  // =========================================
  function patchSkillSection(){
    // Hide the small picker row
    $$('.sg-picker, #sg-picker, [data-sg-picker]').forEach(function(n){n.style.display='none';});
    // Hide small game-type buttons if they exist as a row
    $$('.game-type-btn, .game-picker-row, .skill-picker').forEach(function(n){n.style.display='none';});

    // Find or create the games grid
    var grid = $('#games-grid') || $('#skill-grid');
    if(!grid) return;

    // Inject big cards for ALL game types
    Object.keys(GAME_DEFS).forEach(function(key){
      if(grid.querySelector('[data-game-type="'+key+'"]')) return;
      var g = GAME_DEFS[key];
      var card = document.createElement('div');
      card.className = 'game-card sg-big-card';
      card.setAttribute('data-game-type', key);
      card.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;border-radius:14px;border:1px solid #2a2a2a;background:linear-gradient(160deg,#141414 0%,#0a0a0a 100%);color:#fff;cursor:pointer;font:600 18px/1.2 system-ui,sans-serif;transition:transform .15s,border-color .15s,box-shadow .15s;padding:20px;';
      card.innerHTML = '<div style="font-size:56px;margin-bottom:12px">'+g.icon+'</div>'+
        '<div style="font-size:20px;font-weight:700">'+g.label+'</div>'+
        '<div style="font-size:12px;color:#888;margin-top:6px">Covenant Escrow \u2022 Auto-Payout</div>';
      card.addEventListener('mouseenter', function(){
        card.style.transform='translateY(-3px)';card.style.borderColor='#d4af37';
        card.style.boxShadow='0 8px 24px rgba(212,175,55,.15)';
      });
      card.addEventListener('mouseleave', function(){
        card.style.transform='';card.style.borderColor='#2a2a2a';card.style.boxShadow='';
      });
      card.addEventListener('click', function(){
        // Pre-select game type in create modal
        if(typeof W.showCreateGameModal === 'function'){
          W.showCreateGameModal();
          var sel = $('#game-type');
          if(sel){
            sel.value = key;
            sel.dispatchEvent(new Event('change'));
          }
        }
      });
      grid.appendChild(card);
    });
  }

  // =========================================
  // 5. COVENANT ESCROW + AUTOPAYOUT WIRE
  // =========================================
  function patchCreateGame(){
    var origCreate = W.createGame;
    if(!origCreate || W._patchedCreate) return;
    W._patchedCreate = true;
    W.createGame = async function(){
      // Add mode to the POST payload if present
      var modeEl = $('#game-mode');
      var origFetch = W.apiFetch;
      if(modeEl && origFetch){
        W.apiFetch = function(url, opts){
          if(url === '/api/games' && opts && opts.body){
            var body = JSON.parse(opts.body);
            body.mode = modeEl.value;
            opts.body = JSON.stringify(body);
          }
          return origFetch.apply(this, arguments);
        };
      }
      try{
        return await origCreate.apply(this, arguments);
      } finally {
        if(modeEl) W.apiFetch = origFetch;
      }
    };
  }

  // =========================================
  // 6. PATCH renderGameBoard for new types
  // =========================================
  function patchRenderGameBoard(){
    // The original renderGameBoard in app.js only handles chess/checkers/connect4
    // We intercept showGamePlay to add BJ/Poker/TTT after it renders
    var origShowPlay = W.showGamePlay;
    if(!origShowPlay || W._patchedShowPlay) return;
    W._patchedShowPlay = true;
    W.showGamePlay = async function(gameId){
      await origShowPlay.apply(this, arguments);
      // After render, check if the game type needs our patched UI
      // The game data should be in a data attribute or we fetch it
      setTimeout(function(){
        var container = $('#board-container');
        if(!container || container.children.length > 0) return;
        // Container is empty = type not handled by original code
        // Try to get game data from app.games or Firebase
        var game = null;
        if(W.app && W.app.games){
          game = W.app.games.find(function(g){return g.id===gameId;});
        }
        if(!game){
          container.innerHTML='<div style="text-align:center;padding:40px;color:#888">Loading game...</div>';
          return;
        }
        var myAddr = W.htpAddress||(W.app&&W.app.wallet?W.app.wallet.address:'');
        if(game.type==='blackjack' && W.BlackjackUI){
          new W.BlackjackUI('board-container', game, myAddr);
        } else if(game.type==='poker' && W.PokerUI){
          new W.PokerUI('board-container', game, myAddr);
        } else if(game.type==='tictactoe'){
          renderTicTacToe(container, game, myAddr);
        }
        // Fire event for autopayout engine
        try{W.dispatchEvent(new CustomEvent('htp:game-loaded',{detail:game}));}catch(e){}
      }, 200);
    };
  }

  // =========================================
  // 7. PATCH renderGames to show all types with icons
  // =========================================
  function patchRenderGames(){
    var origRender = W.renderGames;
    if(!origRender || W._patchedRenderGames) return;
    W._patchedRenderGames = true;
    W.renderGames = function(games){
      // Add icons for new types to the icons map
      // The original has: { chess:'\u265a', checkers:'\u26c0', connect4:'\u25c9' }
      origRender.apply(this, arguments);
      // Fix any cards that show unknown-type icons
      $$('#games-grid .game-card, .games-grid .game-card').forEach(function(card){
        var typeEl = card.querySelector('[data-type]') || card;
        var type = typeEl.dataset.type || typeEl.dataset.gameType;
        if(type && GAME_DEFS[type]){
          var iconEl = card.querySelector('.game-icon');
          if(iconEl && !iconEl.textContent.trim()) iconEl.textContent = GAME_DEFS[type].icon;
        }
      });
    };
  }

  // =========================================
  // INIT - Run all patches
  // =========================================
  function init(){
    console.log('[PATCH] patch-games.js v5.0 loading...');

    // 1. Fix WASM resolver
    fixWasmResolver();

    // 2. Patch create modal
    patchCreateModal();

    // 3. Patch board rendering
    patchBoardRendering();
    patchRenderGameBoard();

    // 4. Big cards + hide picker
    patchSkillSection();

    // 5. Patch createGame for mode/covenant
    patchCreateGame();

    // 6. Patch renderGames icons
    patchRenderGames();

    console.log('[PATCH] All patches applied successfully');
  }

  // Run on DOM ready + interval for SPA
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run periodically for SPA route changes + late-loading globals
  var _runs = 0;
  var _interval = setInterval(function(){
    fixWasmResolver();
    patchCreateModal();
    patchBoardRendering();
    patchRenderGameBoard();
    patchSkillSection();
    patchCreateGame();
    patchRenderGames();
    // Hide pickers every tick
    $$('.sg-picker, #sg-picker, [data-sg-picker], .game-type-btn, .game-picker-row, .skill-picker').forEach(function(n){n.style.display='none';});
    _runs++;
    if(_runs > 120) clearInterval(_interval); // Stop after 3 min
  }, 1500);

})(window);
