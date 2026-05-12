/* High Table Protocol — Skill Games v3
 *
 * Adds per-game gated lobby panel, smart per-game settings, payout preview.
 * Hooks into existing window.__htpPickGame entry point.
 * Filters open matches by selected game; shows attractive empty state with
 * a clear Create flow when no games exist for the selection.
 *
 * Stake X each, pot 2X, protocol fee 2%, winner receives pot * 0.98.
 * Creator can cancel before opponent joins; once both staked, leaving = forfeit.
 */
(function(){
  'use strict';

  var FEE_PCT = 0.02;
  var GAMES = ['chess','connect4','checkers','tictactoe','poker','blackjack'];
  var GAME_LABELS = {
    chess:'Chess',
    connect4:'Connect 4',
    checkers:'Checkers',
    tictactoe:'Tic Tac Toe',
    poker:"Texas Hold'em",
    blackjack:'Blackjack'
  };
  var GAME_ICONS = {
    chess:'♞',
    connect4:'⬡',
    checkers:'◉',
    tictactoe:'✕',
    poker:'♠',
    blackjack:'♣'
  };

  var GAME_COLORS = {
    chess:     '#00ffa3',
    connect4:  '#00ffa3',
    checkers:  '#00ffa3',
    tictactoe: '#00ffa3',
    poker:     '#00ffa3',
    blackjack: '#00ffa3'
  };

  // ----- DOM helpers -----
  function $(id){ return document.getElementById(id); }
  function el(html){ var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function cleanEmDashes(){
    try {
      var skip = {SCRIPT:1, STYLE:1, CODE:1, PRE:1, INPUT:1, TEXTAREA:1};
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var n;
      while ((n = w.nextNode())) {
        if (!n.parentNode || skip[n.parentNode.nodeName]) continue;
        var t = n.nodeValue;
        if (!t || (t.indexOf('\u2014') < 0 && t.indexOf('\u2013') < 0)) continue;
        n.nodeValue = t.replace(/\u2014/g, ', ').replace(/\u2013/g, ', ');
      }
    } catch(e) { console.warn('[HTP-Skill-v3] em dash scrub failed', e); }
  }

  // ----- Payout math -----
  function payout(stakeKas){
    var s = parseFloat(stakeKas) || 0;
    var pot = s * 2;
    var fee = pot * FEE_PCT;
    var win = pot - fee;
    return { stake: s, pot: pot, fee: fee, winner: win };
  }
  function fmt(n){
    if (!isFinite(n)) return '-';
    if (n >= 1000) return n.toLocaleString(undefined,{maximumFractionDigits:2});
    return (Math.round(n*100)/100).toString();
  }

  // ----- Per-game settings registry -----
  var SETTINGS = {
    chess: {
      hint: 'Standard chess clock. Minutes + increment per move.',
      time: ['1|0','1|1','3|0','3|2','5|0','5|3','10|0','10|5','15|10','30|0','60|30'],
      series: [1,3,5,7],
      extras: function(){ return [
        opt('chessColor','Your Color', sel('sgv3ChessColor', [
          ['random','Random'],['white','White'],['black','Black']
        ], 'random'), 'Color is final once locked'),
        opt('chessRanked','Match Type', sel('sgv3ChessRanked', [
          ['casual','Casual'],['ranked','Ranked']
        ], 'casual'), 'Ranked affects on-chain ELO record'),
        opt('chessDraw','Draw Policy', sel('sgv3ChessDraw', [
          ['mutual','Mutual agreement'],['none','No draw offers']
        ], 'mutual'), 'Stalemate / 50-move rule always counts')
      ]; }
    },
    checkers: {
      hint: 'American checkers move clock.',
      time: ['3|0','5|0','5|3','10|0','10|5','15|0'],
      series: [1,3,5,7],
      extras: function(){ return [
        opt('ckForce','Forced Capture', sel('sgv3CkForce', [
          ['1','Mandatory captures'],['0','Captures optional']
        ], '1'), 'Standard rules require captures'),
        opt('ckMulti','Multi-Jump', sel('sgv3CkMulti', [
          ['1','Multi-jumps allowed'],['0','Single jumps only']
        ], '1'), 'Chained captures in one turn'),
        opt('ckKing','King Row', sel('sgv3CkKing', [
          ['standard','Standard (turn ends on promotion)'],['flying','Flying kings (long diagonals)']
        ], 'standard'), 'Promotion behavior')
      ]; }
    },
    connect4: {
      hint: 'Drop piece move clock. Width affects game length.',
      time: ['1|0','2|0','3|0','5|0','10|0'],
      series: [1,3,5,7],
      extras: function(){ return [
        opt('c4First','First Mover', sel('sgv3C4First', [
          ['random','Random'],['creator','Creator'],['joiner','Joiner']
        ], 'random'), 'Red drops first'),
        opt('c4Cols','Board Width', sel('sgv3C4Cols', [
          ['7','7 columns (standard)'],['9','9 columns (long)']
        ], '7'), 'Wider boards mean longer games'),
        opt('c4Series','Series Length', sel('sgv3C4Series', [
          ['1','Single'],['3','Best of 3'],['5','Best of 5']
        ], '1'), 'Best-of series, side alternates')
      ]; }
    },
    tictactoe: {
      hint: 'Per-move clock, in seconds for quick or minutes for standard.',
      time: ['0|5','0|10','0|15','0|30','1|0','2|0','3|0','5|0'],
      series: [1,3,5,7,9],
      extras: function(){ return [
        opt('tttQuick','Pace', sel('sgv3TTTQuick', [
          ['0','Standard'],['1','Quick (5s/move)']
        ], '0'), 'Quick mode forces fast moves'),
        opt('tttFirst','First Mover', sel('sgv3TTTFirst', [
          ['random','Random'],['creator','Creator'],['joiner','Joiner']
        ], 'random'), 'X moves first'),
        opt('tttBest','Series', sel('sgv3TTTBest', [
          ['1','Single game'],['3','Best of 3'],['5','Best of 5']
        ], '1'), 'Sides swap each round')
      ]; }
    },
    poker: {
      hint: "Heads-up / multi-seat hold'em. Per-decision action clock, plus optional blind interval.",
      time: ['15s','20s','30s','45s','60s'],
      series: [1],
      extras: function(){ return [
        opt('pkSeats','Seats', sel('sgv3PkSeats', [
          ['2','Heads-up (2)'],['3','3-handed'],['6','6-max']
        ], '2'), 'Heads-up uses big-blind small-blind rotation'),
        opt('pkBlinds','Blinds (KAS)', sel('sgv3PkBlinds', [
          ['0.05/0.10','SB 0.05 / BB 0.10'],
          ['0.5/1','SB 0.5 / BB 1'],
          ['2/5','SB 2 / BB 5'],
          ['10/20','SB 10 / BB 20']
        ], '0.5/1'), 'Stake is the buy-in; blinds drive the pot'),
        opt('pkBlindLvl','Blind Interval', sel('sgv3PkBlindLvl', [
          ['none','Cash (no level-up)'],
          ['10','Tournament 10 min levels'],
          ['20','Tournament 20 min levels']
        ], 'none'), 'Cash holds blinds steady; tournament doubles per level')
      ]; }
    },
    blackjack: {
      hint: 'Heads-up no-house blackjack. Round timer, dealer rule selectable.',
      time: ['1|0','3|0','5|0'],
      series: [1,3,5],
      extras: function(){ return [
        opt('bjDecks','Decks', sel('sgv3BjDecks', [
          ['1','1 deck'],['2','2 decks'],['6','6 decks (shoe)']
        ], '2'), 'Shared shuffled shoe via commit-reveal'),
        opt('bjRounds','Rounds', sel('sgv3BjRounds', [
          ['1','Single hand'],['3','Best of 3'],['5','Best of 5']
        ], '1'), 'Most rounds wins the escrow'),
        opt('bjSoft17','Soft 17', sel('sgv3BjSoft17', [
          ['stand','Stand on soft 17'],['hit','Hit soft 17']
        ], 'stand'), 'Applies when one side acts as dealer')
      ]; }
    }
  };

  function opt(name,label,html,hint){
    return '<div class="sgv3-fg" data-extra="'+name+'">'+
      '<label>'+label+'</label>'+ html +
      (hint?'<div class="sgv3-hint">'+hint+'</div>':'')+
    '</div>';
  }
  function sel(id, options, defVal){
    var o = '';
    options.forEach(function(p){
      var v = p[0], l = p[1];
      o += '<option value="'+v+'"'+(v===defVal?' selected':'')+'>'+l+'</option>';
    });
    return '<select id="'+id+'">'+o+'</select>';
  }

  function timeLabel(game, raw){
    if (game === 'poker') return 'Action clock ' + raw;
    if (raw.indexOf('|') >= 0) {
      var p = raw.split('|');
      return p[0] + '+' + p[1];
    }
    return raw;
  }

  // ----- Lobby filtering & rendering -----
  function getMatches(){
    if (window.matchLobby && Array.isArray(window.matchLobby.matches)) return window.matchLobby.matches;
    return [];
  }
  function getMyId(){
    return (window.matchLobby && window.matchLobby.myPlayerId) || 'P-LOCAL';
  }

  function injectPanel(){
    var section = document.getElementById('v-skill');
    if (!section) return;
    if (document.getElementById('sgv3-panel')) return;

    var grid = section.querySelector('.sgv2-grid');
    if (!grid) return;

    var panel = el(
      '<div id="sgv3-panel" class="sgv3-panel" hidden>'+
        '<div class="sgv3-panel-head">'+
          '<div class="sgv3-panel-title">'+
            '<span class="sgv3-icon" id="sgv3IconBig"></span>'+
            '<span>'+
              '<span class="sgv3-eyebrow">Selected Game</span>'+
              '<span class="sgv3-name" id="sgv3GameName">Chess</span>'+
            '</span>'+
          '</div>'+
          '<button type="button" class="sgv3-close" id="sgv3Close" aria-label="Close">&#x2715;</button>'+
        '</div>'+

        '<div class="sgv3-tabs" role="tablist">'+
          '<button type="button" class="sgv3-tab act" data-tab="open" role="tab">Open Games</button>'+
          '<button type="button" class="sgv3-tab" data-tab="create" role="tab">Create New</button>'+
          '<button type="button" class="sgv3-tab" data-tab="rules" role="tab">Rules / Payout</button>'+
        '</div>'+

        '<div class="sgv3-tabbody" data-tab="open">'+
          '<div id="sgv3OpenList" class="sgv3-open-list"></div>'+
        '</div>'+

        '<div class="sgv3-tabbody" data-tab="create" hidden>'+
          '<div class="sgv3-create-grid">'+
            '<div class="sgv3-fg">'+
              '<label>Stake (KAS)</label>'+
              '<input type="number" id="sgv3Stake" value="5" min="1" max="10000" step="1" />'+
              '<div class="sgv3-hint">Equal stake on both sides</div>'+
            '</div>'+
            '<div class="sgv3-fg">'+
              '<label>Time Control</label>'+
              '<select id="sgv3Time"></select>'+
              '<div class="sgv3-hint" id="sgv3TimeHint">Per-move timer</div>'+
            '</div>'+
            '<div class="sgv3-fg">'+
              '<label>Series</label>'+
              '<select id="sgv3Series"></select>'+
              '<div class="sgv3-hint">Sides alternate each round</div>'+
            '</div>'+
            '<div class="sgv3-fg">'+
              '<label>Match Visibility</label>'+
              '<select id="sgv3Visibility"><option value="public" selected>Public lobby</option><option value="link">Private link only</option></select>'+
              '<div class="sgv3-hint">Public listed in Open Games</div>'+
            '</div>'+
          '</div>'+
          '<div id="sgv3Extras" class="sgv3-create-grid sgv3-extras"></div>'+

          '<div id="sgv3Payout" class="sgv3-payout"></div>'+

          '<div class="sgv3-actions">'+
            '<button type="button" class="sgv3-btn sgv3-btn-primary" id="sgv3CreateBtn">Create Match, Lock Escrow</button>'+
            '<button type="button" class="sgv3-btn sgv3-btn-ghost" id="sgv3ResetBtn">Reset</button>'+
          '</div>'+
          '<div class="sgv3-fineprint">Creator can cancel and recover stake until an opponent joins. Once both stakes are locked, abandoning the match counts as a forfeit.</div>'+
        '</div>'+

        '<div class="sgv3-tabbody" data-tab="rules" hidden>'+
          '<div id="sgv3Rules" class="sgv3-rules"></div>'+
        '</div>'+
      '</div>'
    );

    grid.parentNode.insertBefore(panel, grid.nextSibling);
    wireEvents();
  }

  function wireEvents(){
    var panel = $('sgv3-panel');
    if (!panel) return;
    qsa('.sgv3-tab', panel).forEach(function(b){
      b.addEventListener('click', function(){ activateTab(b.getAttribute('data-tab')); });
    });
    var closeBtn = $('sgv3Close');
    if (closeBtn) closeBtn.addEventListener('click', function(){ panel.hidden = true; });
    var stakeEl = $('sgv3Stake');
    if (stakeEl) stakeEl.addEventListener('input', renderPayout);
    var timeEl = $('sgv3Time');
    if (timeEl) timeEl.addEventListener('change', renderPayout);
    var seriesEl = $('sgv3Series');
    if (seriesEl) seriesEl.addEventListener('change', renderPayout);
    var resetBtn = $('sgv3ResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', function(){ if (window.__htpSkillCurrentGame) renderForGame(window.__htpSkillCurrentGame); });
    var createBtn = $('sgv3CreateBtn');
    if (createBtn) createBtn.addEventListener('click', handleCreate);
  }

  function activateTab(name){
    var panel = $('sgv3-panel');
    if (!panel) return;
    qsa('.sgv3-tab', panel).forEach(function(b){
      b.classList.toggle('act', b.getAttribute('data-tab') === name);
    });
    qsa('.sgv3-tabbody', panel).forEach(function(body){
      body.hidden = body.getAttribute('data-tab') !== name;
    });
    if (name === 'open') refreshOpenList();
  }

  function setGameName(game){
    var nm = $('sgv3GameName');
    if (nm) nm.textContent = GAME_LABELS[game] || game;
    var ic = $('sgv3IconBig');
    if (ic) {
      ic.textContent = GAME_ICONS[game] || '?';
      var col = GAME_COLORS[game] || '#49e8c2';
      ic.style.color = col;
      ic.style.borderColor = col;
      ic.style.boxShadow = 'inset 0 0 18px ' + col + '22';
    }
    var panel = $('sgv3-panel');
    if (panel) panel.setAttribute('data-game', game);
  }

  function fillTimeOptions(game){
    var s = SETTINGS[game];
    var t = $('sgv3Time'), ser = $('sgv3Series'), hint = $('sgv3TimeHint');
    if (!s || !t || !ser) return;
    t.innerHTML = s.time.map(function(v){ return '<option value="'+v+'">'+timeLabel(game,v)+'</option>'; }).join('');
    ser.innerHTML = s.series.map(function(n){ return '<option value="'+n+'">'+(n===1?'Single':'Best of '+n)+'</option>'; }).join('');
    if (hint) hint.textContent = s.hint;
  }

  function fillExtras(game){
    var s = SETTINGS[game];
    var box = $('sgv3Extras');
    if (!s || !box) return;
    box.innerHTML = s.extras().join('');
  }

  function renderPayout(){
    var box = $('sgv3Payout');
    var stakeEl = $('sgv3Stake');
    if (!box || !stakeEl) return;
    var p = payout(stakeEl.value);
    box.innerHTML =
      '<div class="sgv3-payout-row">'+
        '<div class="sgv3-payout-cell"><span class="sgv3-pl">Your Stake</span><span class="sgv3-pv">'+fmt(p.stake)+' KAS</span></div>'+
        '<div class="sgv3-payout-cell"><span class="sgv3-pl">Opponent Stake</span><span class="sgv3-pv">'+fmt(p.stake)+' KAS</span></div>'+
        '<div class="sgv3-payout-cell"><span class="sgv3-pl">Total Pot</span><span class="sgv3-pv">'+fmt(p.pot)+' KAS</span></div>'+
        '<div class="sgv3-payout-cell"><span class="sgv3-pl">Protocol Fee (2%)</span><span class="sgv3-pv">'+fmt(p.fee)+' KAS</span></div>'+
        '<div class="sgv3-payout-cell sgv3-pwin"><span class="sgv3-pl">Winner Receives</span><span class="sgv3-pv">'+fmt(p.winner)+' KAS</span></div>'+
      '</div>'+
      '<div class="sgv3-fineprint">Winner takes all minus 2% protocol fee. Loser receives nothing. If the match never starts (no opponent), creator recovers full stake on cancel.</div>';
  }

  function renderRules(game){
    var box = $('sgv3Rules');
    if (!box) return;
    var s = SETTINGS[game];
    var stakeEl = $('sgv3Stake');
    var p = payout(stakeEl ? stakeEl.value : 5);
    var rules = {
      chess: 'Full FIDE rules. Checkmate, resignation, and time-out resolve the match. Stalemate and threefold repetition are draws and refund both players minus the protocol fee on the pot.',
      checkers: 'American checkers. Forced captures by default. Multi-jumps chain in one turn. Promotion to king on the back row.',
      connect4: 'First to align four in a row, column, or diagonal wins. Red drops first by default.',
      tictactoe: 'Three in a row wins. Tied boards are draws. Side alternates each round in series.',
      poker: "Heads-up Texas Hold'em. Each decision has an action clock; if it expires, the player auto-checks or auto-folds depending on context. Cards committed via hash, revealed at showdown. The covenant only verifies the final hand and pot allocation.",
      blackjack: 'No-house heads-up blackjack. Closest to 21 wins; bust auto-loses. Shoe is committed via shared hashed seed. Soft 17 rule selectable.'
    };
    box.innerHTML =
      '<h4>How '+ (GAME_LABELS[game]||game) +' settles on Kaspa</h4>'+
      '<p>'+ (rules[game] || 'Game rules enforced by covenant.') +'</p>'+
      '<h4>Payout</h4>'+
      '<p>Both sides stake an equal amount X. The pot is 2X. The protocol takes a 2% fee. The winner receives 1.96X. With your current stake of <strong>'+ fmt(p.stake) +' KAS</strong>, the winner receives <strong>'+ fmt(p.winner) +' KAS</strong>.</p>'+
      '<h4>Network status</h4>'+
      '<p>Match escrow is generated as a Kaspa Toccata covenant address. Toccata is live on testnet, TN12, today. Mainnet activation depends on the hardcoded activation flag, so on-chain settlement may run in dry-run mode if mainnet is selected before activation. Dry-run mode is logged and never reports false success.</p>';
  }

  function refreshOpenList(){
    var game = window.__htpSkillCurrentGame;
    var list = $('sgv3OpenList');
    if (!game || !list) return;
    var matches = getMatches().filter(function(m){
      return m.game === game && (m.status === 'waiting' || m.status === 'active');
    });
    if (!matches.length){
      list.innerHTML =
        '<div class="sgv3-empty">'+
          '<div class="sgv3-empty-icon">'+ (GAME_ICONS[game]||'?') +'</div>'+
          '<div class="sgv3-empty-title">No open '+ (GAME_LABELS[game]||game) +' matches yet</div>'+
          '<div class="sgv3-empty-sub">Be the first to post a match. Set your stake, lock escrow, share the link, and wait for an opponent to join.</div>'+
          '<button type="button" class="sgv3-btn sgv3-btn-primary" data-action="goto-create">Create the First '+ (GAME_LABELS[game]||game) +' Match</button>'+
        '</div>';
      var b = list.querySelector('[data-action="goto-create"]');
      if (b) b.addEventListener('click', function(){ activateTab('create'); });
      return;
    }
    var myId = getMyId();
    var html = '';
    matches.forEach(function(m){
      var isMe = m.creatorId === myId;
      var tc   = m.timeControl || m.time || '?';
      var ser  = m.series > 1 ? 'Best of ' + m.series : 'Single';
      html +=
        '<div class="sgv3-mcard'+(isMe?' sgv3-mcard-active':'')+'">'+
          '<div class="sgv3-mcard-side">'+
            '<div class="sgv3-mcard-icon">'+(GAME_ICONS[game]||'?')+'</div>'+
            '<div class="sgv3-mcard-meta">'+
              '<div class="sgv3-mcard-title">'+(GAME_LABELS[game]||game)+' <span class="sgv3-mcard-id">#'+m.matchId+'</span></div>'+
              '<div class="sgv3-mcard-row">'+
                '<span>&#9651; '+ fmt(m.stakeKas||0) +' KAS each</span>'+
                '<span>&#9650; '+ fmt((m.stakeKas||0)*2*0.98) +' KAS winner</span>'+
                '<span>&#x23F1; '+ tc +'</span>'+
                '<span>&#9776; '+ ser +'</span>'+
              '</div>'+
              '<div class="sgv3-mcard-row">'+
                '<span class="sgv3-badge '+(m.status==='active'?'sgv3-badge-active':'sgv3-badge-open')+'">'+
                  (m.status === 'active' ? 'In Progress' : 'Open')+
                '</span>'+
                (isMe ? '<span class="sgv3-badge sgv3-badge-mine">Your Match</span>' : '')+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="sgv3-mcard-actions">'+
            ((!isMe && m.status === 'waiting') ?
              '<button type="button" class="sgv3-btn sgv3-btn-primary" data-join="'+m.matchId+'">Join &amp; Stake</button>' : '')+
            (isMe ?
              '<button type="button" class="sgv3-btn sgv3-btn-danger" data-cancel="'+m.matchId+'">Cancel</button>' : '')+
          '</div>'+
        '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('[data-join]').forEach(function(b){
      b.addEventListener('click', function(){
        var mid = b.getAttribute('data-join');
        if (typeof window.joinMatchWithLobby === 'function') window.joinMatchWithLobby(mid);
        else if (typeof window.showToast === 'function') window.showToast('Join flow not loaded yet', 'warn');
      });
    });
    list.querySelectorAll('[data-cancel]').forEach(function(b){
      b.addEventListener('click', function(){
        var mid = b.getAttribute('data-cancel');
        if (typeof window.cancelMatchEscrow === 'function') window.cancelMatchEscrow(mid);
        else if (typeof window.showToast === 'function') window.showToast('Cancel flow not loaded yet', 'warn');
      });
    });
  }

  function handleCreate(){
    var game = window.__htpSkillCurrentGame;
    if (!game) { if (window.showToast) window.showToast('Select a game first', 'warn'); return; }

    var stakeEl  = $('sgv3Stake'),  timeEl = $('sgv3Time'),  seriesEl = $('sgv3Series');
    var visEl    = $('sgv3Visibility');
    if (!stakeEl || !timeEl || !seriesEl) return;

    var stake    = parseFloat(stakeEl.value)  || 5;
    var time     = timeEl.value               || '5|0';
    var series   = parseInt(seriesEl.value,10) || 1;
    var vis      = visEl ? visEl.value : 'public';

    var extras = {};
    qsa('[data-extra]', $('sgv3Extras')).forEach(function(fg){
      var name = fg.getAttribute('data-extra');
      var inp  = fg.querySelector('input, select');
      if (inp) extras[name] = inp.value;
    });

    var sgGame = document.getElementById('sgGame');
    if (sgGame && sgGame.value !== game) {
      sgGame.value = game;
    }
    var sgTime = $('sgTime');
    if (sgTime) {
      var has = false;
      for (var i=0;i<sgTime.options.length;i++) if (sgTime.options[i].value===time) { has=true; break; }
      if (!has) {
        var o = document.createElement('option'); o.value = time; o.textContent = timeLabel(game,time);
        sgTime.appendChild(o);
      }
      sgTime.value = time;
    }
    var sgSeries = $('sgSeries');
    if (sgSeries) {
      var has2 = false;
      for (var j=0;j<sgSeries.options.length;j++) if (sgSeries.options[j].value===String(series)) { has2=true; break; }
      if (!has2) {
        var o2 = document.createElement('option'); o2.value = String(series); o2.textContent = series===1?'Single game':'Best of '+series;
        sgSeries.appendChild(o2);
      }
      sgSeries.value = String(series);
    }
    var sgEsc = $('sgEsc');
    if (sgEsc) sgEsc.value = stake;

    window.__htpSkillExtras = { game: game, settings: extras };

    if (typeof window.createMatchWithLobby === 'function') {
      try { window.createMatchWithLobby(); }
      catch(e){ console.error('[HTP-Skill-v3] create error', e); }
    } else if (typeof window.showToast === 'function') {
      window.showToast('Create flow not loaded yet, try again in a second', 'warn');
    }
  }

  function renderForGame(game){
    if (!game || !SETTINGS[game]) return;
    window.__htpSkillCurrentGame = game;
    var panel = $('sgv3-panel');
    if (!panel) return;
    panel.hidden = false;
    setGameName(game);
    fillTimeOptions(game);
    fillExtras(game);
    renderPayout();
    refreshOpenList();
    renderRules(game);
    activateTab('open');
    try { panel.scrollIntoView({behavior:'smooth', block:'start'}); } catch(e){}
  }

  var _origPick = window.__htpPickGame;
  window.__htpPickGame = function(game){
    try { if (typeof _origPick === 'function') _origPick(game); } catch(e){}
    renderForGame(game);
  };

  // Fix empty sg-ico spans in the game picker (index.html has empty spans for connect4/checkers).
  function fixPickerIcons(){
    var iconMap = {chess:'♞',connect4:'⬡',checkers:'◉',tictactoe:'✕',poker:'♠',blackjack:'♣'};
    qsa('#sgGamePicker .sg-gbtn, #v-skill .sgv2-gpick button').forEach(function(btn){
      var game = btn.getAttribute('data-game'); if (!game) return;
      var ico  = btn.querySelector('.sg-ico');
      if (ico && !ico.textContent.trim()) ico.textContent = iconMap[game] || '?';
      if (ico && GAME_COLORS[game]) ico.style.color = GAME_COLORS[game];
    });
  }

  // Tag each sgv2-card with its game and set --card-accent CSS variable.
  function decorateCards(){
    var gameOrder = ['chess','connect4','checkers','tictactoe','poker','blackjack'];
    qsa('#v-skill .sgv2-card').forEach(function(c, i){
      c.classList.add('sgv3-pressable');
      var g = gameOrder[i] || '';
      if (!g) return;
      c.setAttribute('data-game', g);
      if (GAME_COLORS[g]) c.style.setProperty('--card-accent', GAME_COLORS[g]);
    });
    fixPickerIcons();
  }

  function startTicker(){
    if (window.__htpSkillTicker) return;
    window.__htpSkillTicker = setInterval(function(){
      if (!window.__htpSkillCurrentGame) return;
      var panel = $('sgv3-panel');
      if (!panel || panel.hidden) return;
      var openTab = panel.querySelector('.sgv3-tab.act');
      if (openTab && openTab.getAttribute('data-tab') === 'open') refreshOpenList();
    }, 4000);
  }

  function init(){
    try {
      injectPanel();
      decorateCards();
      cleanEmDashes();
      startTicker();
      console.log('[HTP-Skill-v3] initialized');
    } catch (e) {
      console.error('[HTP-Skill-v3] init failed', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.htpSkillV3 = {
    payout: payout,
    open: function(g){ renderForGame(g); },
    refresh: refreshOpenList,
    settings: SETTINGS
  };
})();
