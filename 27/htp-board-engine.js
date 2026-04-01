/**
 * htp-board-engine.js  — HTP Board Engine v1
 * Fixes ALL game board issues for Chess, Connect4, Checkers (creator + joiner):
 *
 *  1. TX amount pipeline  — htp-multi-fix.js hard-coded 5 KAS removed
 *  2. Board opens optimistically — no longer gated on escrow UTXO confirmation
 *  3. Color assignment written to Firebase so both sides agree
 *  4. Full move history replay on join (not just live listener)
 *  5. Clock sync message on every move (both sides stay in lockstep)
 *  6. Chess pieces: white=white, black=black (no inherited teal accent)
 *  7. Connect4 + Checkers: same relay-first-then-live pattern
 *
 * LOAD ORDER: inject as LAST script tag, after all other htp-*.js files
 */
;(function () {
  'use strict';

  const LOG = (...a) => console.log('[HTP Board Engine v1]', ...a);
  const ERR = (...a) => console.error('[HTP Board Engine v1]', ...a);

  // ─────────────────────────────────────────────────────────────────────────────
  // 0. PATCH htp-multi-fix.js hard-coded 5 KAS stake normalisation
  //    The original patch at htp-multi-fix.js:43 does:
  //      `const stake = 5; sompi = kaspaToSompi(stake)`
  //    regardless of what the match object says.  We wrap joinLobbyMatch
  //    *after* multi-fix has run and correct the amount field from match.stake.
  // ─────────────────────────────────────────────────────────────────────────────
  function patchJoinAmount () {
    const orig = window.joinLobbyMatch;
    if (!orig || orig._boardEnginePatched) return;

    window.joinLobbyMatch = async function (matchId) {
      // Resolve the canonical stake from whichever store has it
      const m =
        (window.matchLobby && window.matchLobby.matches &&
          window.matchLobby.matches.find(x => x.id === matchId)) ||
        (window.htpMatches && window.htpMatches[matchId]) ||
        (window.openMatches && window.openMatches[matchId]);

      if (m) {
        // Normalise to KAS float and then to sompi — never hard-code 5
        const stakeKas = parseFloat(m.stakeKas || m.stake || m.escrowKas || 0);
        const stakeSompi = Math.round(stakeKas * 1e8);
        if (stakeSompi > 0) {
          m.stakeKas   = stakeKas;
          m.stakeSompi = stakeSompi;
          m.amount     = stakeSompi;  // what htpSendTx expects
          LOG(`stake normalised from match: ${stakeKas} KAS → ${stakeSompi} sompi`);
        } else {
          ERR(`stake resolution failed for ${matchId}`, m);
        }
      }

      return orig.call(this, matchId);
    };
    window.joinLobbyMatch._boardEnginePatched = true;
    LOG('joinLobbyMatch stake patch installed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PATCH htpSendTx amount forwarding
  //    The Payload patch at index.html:~35534 does `opts.amount` lookup which
  //    is undefined when called as htpSendTx(addr, sompi, {payload, matchId}).
  //    We intercept at the TOP of the chain and always forward amount correctly.
  // ─────────────────────────────────────────────────────────────────────────────
  function patchSendTxAmount () {
    const orig = window.htpSendTx;
    if (!orig || orig._boardEnginePatched) return;

    window.htpSendTx = async function (toOrOpts, amountRaw, opts) {
      let to, amountSompi, extraOpts;

      // Object-form: htpSendTx({to, amount, ...})
      if (toOrOpts && typeof toOrOpts === 'object' && !Array.isArray(toOrOpts)) {
        to          = toOrOpts.to || toOrOpts.address || toOrOpts.recipient;
        amountRaw   = toOrOpts.amount ?? toOrOpts.sompi ?? toOrOpts.value ?? amountRaw;
        extraOpts   = toOrOpts;
      } else {
        to        = toOrOpts;
        extraOpts = opts || {};
      }

      // Resolve amount: KAS float → sompi, or pass-through if already sompi
      if (typeof amountRaw === 'number') {
        amountSompi = amountRaw < 1e7
          ? Math.round(amountRaw * 1e8)   // KAS float
          : Math.round(amountRaw);         // already sompi-range
      } else if (typeof amountRaw === 'bigint') {
        amountSompi = Number(amountRaw);
      } else if (typeof amountRaw === 'string') {
        amountSompi = parseInt(amountRaw, 10);
      }

      // Last resort: recover from match store via matchId
      if (!amountSompi || isNaN(amountSompi)) {
        const mid = extraOpts.matchId;
        if (mid) {
          try {
            const stores = [window.htpMatches, window.openMatches,
              window.matchLobby && window.matchLobby.matches
                ? Object.fromEntries(window.matchLobby.matches.map(x => [x.id, x])) : {}];
            for (const s of stores) {
              const rec = s && s[mid];
              if (rec) {
                const kas = parseFloat(rec.stakeKas || rec.stake || 0);
                if (kas > 0) { amountSompi = Math.round(kas * 1e8); break; }
              }
            }
          } catch (e) { /* ignore */ }
        }
      }

      // Also pull from opts fields
      if (!amountSompi || isNaN(amountSompi)) {
        const v = extraOpts.amount ?? extraOpts.sompi ?? extraOpts.stake;
        if (v) {
          const n = parseFloat(v);
          amountSompi = n < 1e7 ? Math.round(n * 1e8) : Math.round(n);
        }
      }

      if (!amountSompi || isNaN(amountSompi) || amountSompi <= 0) {
        ERR('BLOCKED — cannot resolve amount. Raw:', amountRaw, 'opts:', extraOpts);
        throw new Error('htpSendTx: amount could not be resolved');
      }

      const mergedOpts = Object.assign({}, extraOpts, { amount: amountSompi });
      LOG(`Sending tx → ${String(to).slice(0, 30)}… ${amountSompi} sompi`);
      return orig.call(this, to, amountSompi, mergedOpts);
    };
    window.htpSendTx._boardEnginePatched = true;
    LOG('htpSendTx amount patch installed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PATCH createMatchWithLobby — open board OPTIMISTICALLY for creator
  //    Currently creator never sees the board because playMatch() is only
  //    called by the joiner path.  After a successful escrow TX the creator
  //    should also see the board immediately (waiting for opponent state).
  // ─────────────────────────────────────────────────────────────────────────────
  function patchCreateForCreatorBoard () {
    const orig = window.createMatchWithLobby;
    if (!orig || orig._boardEngineCreatorPatched) return;

    window.createMatchWithLobby = async function (...args) {
      let matchId = null;
      try {
        const result = await orig.apply(this, args);
        // result may be a match object or void depending on version
        if (result && result.id) matchId = result.id;
        // Also check matchLobby for most-recently created match
        if (!matchId && window.matchLobby && window.matchLobby.matches &&
            window.matchLobby.matches.length) {
          matchId = window.matchLobby.matches[window.matchLobby.matches.length - 1].id;
        }
        if (matchId) {
          LOG('Creator board opening for', matchId);
          setTimeout(() => openGameBoard(matchId, 'creator'), 600);
        }
        return result;
      } catch (e) {
        ERR('createMatchWithLobby error', e);
        throw e;
      }
    };
    window.createMatchWithLobby._boardEngineCreatorPatched = true;
    LOG('createMatchWithLobby creator-board patch installed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PATCH joinLobbyMatch — open board for joiner after TX
  // ─────────────────────────────────────────────────────────────────────────────
  function patchJoinForBoard () {
    const orig = window.joinLobbyMatch;
    if (!orig || orig._boardEngineJoinPatched) return;

    window.joinLobbyMatch = async function (matchId) {
      try {
        const result = await orig.call(this, matchId);
        LOG('Joiner board opening for', matchId);
        setTimeout(() => openGameBoard(matchId, 'joiner'), 600);
        return result;
      } catch (e) {
        ERR('joinLobbyMatch error', e);
        throw e;
      }
    };
    window.joinLobbyMatch._boardEngineJoinPatched = true;
    LOG('joinLobbyMatch board patch installed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CORE: openGameBoard — unified board launcher for all games
  // ─────────────────────────────────────────────────────────────────────────────
  async function openGameBoard (matchId, role) {
    // Resolve match object from any available store
    let m = null;
    const stores = [
      window.htpMatches,
      window.openMatches,
      window.matchLobby && window.matchLobby.matches
        ? Object.fromEntries((window.matchLobby.matches || []).map(x => [x.id, x])) : null
    ].filter(Boolean);

    for (const s of stores) {
      if (s[matchId]) { m = s[matchId]; break; }
    }

    // Firebase fallback
    if (!m && window.firebase) {
      try {
        const snap = await firebase.database().ref(`matches/${matchId}/info`).once('value');
        if (snap.val()) {
          m = snap.val();
          m.id = matchId;
        }
      } catch (e) { /* ignore */ }
    }

    if (!m) {
      ERR('openGameBoard: match not found', matchId);
      return;
    }

    const game = (m.game || m.gameType || 'chess').toLowerCase();
    const myId = window.matchLobby && window.matchLobby.myPlayerId;
    const isCreator = m.creator === myId;

    // Determine colour assignment (deterministic, stored to Firebase for agreement)
    let mySide = await resolveColorAssignment(matchId, m, isCreator);

    // Parse time control
    const timeStr = String(m.timeControl || m.time || '5+0');
    const timeSec  = parseTimeControl(timeStr);

    const opts = {
      id:       matchId,
      side:     mySide,
      time:     timeSec,
      stake:    parseFloat(m.stakeKas || m.stake || 5),
      game,
      creator:  m.creator,
      opponent: m.opponent,
      role
    };

    // Store as active match
    if (window.matchLobby) window.matchLobby.activeMatch = m;

    LOG(`Opening ${game} board for ${matchId}, side=${mySide}, role=${role}`);

    // Connect relay BEFORE opening board so we don't miss moves
    if (typeof window.connectRelay === 'function') {
      window.connectRelay(matchId, game);
    }

    // Replay move history so joiner catches up
    await replayMoveHistory(matchId, game);

    // Open the correct board
    if (game === 'chess' || game === 'chess960') {
      launchChessBoard(opts);
    } else if (game === 'c4' || game === 'connect4') {
      launchConnect4Board(opts);
    } else if (game === 'ck' || game === 'checkers') {
      launchCheckersBoard(opts);
    } else {
      ERR('Unknown game type:', game);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. COLOR ASSIGNMENT — deterministic + Firebase-confirmed
  // ─────────────────────────────────────────────────────────────────────────────
  async function resolveColorAssignment (matchId, m, isCreator) {
    // Check if already stored in Firebase
    if (window.firebase) {
      try {
        const snap = await firebase.database()
          .ref(`matches/${matchId}/colorAssignment`).once('value');
        const ca = snap.val();
        if (ca) {
          const myId = window.matchLobby && window.matchLobby.myPlayerId;
          if (ca.creator && ca.opponent) {
            return isCreator ? ca.creator : ca.opponent;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Compute deterministically from matchId
    const idStr = matchId.replace('HTP-', '');
    let seed = 0;
    for (let i = 0; i < idStr.length; i++) seed += idStr.charCodeAt(i);
    const creatorGetsWhite = (seed % 2 === 0);

    const assignment = {
      creator:  creatorGetsWhite ? 'w' : 'b',
      opponent: creatorGetsWhite ? 'b' : 'w'
    };

    // Write to Firebase so both sides agree
    if (window.firebase && isCreator) {
      try {
        await firebase.database()
          .ref(`matches/${matchId}/colorAssignment`).set(assignment);
      } catch (e) { /* ignore */ }
    }

    return isCreator ? assignment.creator : assignment.opponent;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. MOVE HISTORY REPLAY — fetch all past moves, apply before live listener
  // ─────────────────────────────────────────────────────────────────────────────
  async function replayMoveHistory (matchId, game) {
    if (!window.firebase) return;
    try {
      const snap = await firebase.database()
        .ref(`relay/${matchId}/moves`).orderByChild('ts').once('value');
      const moves = [];
      snap.forEach(child => moves.push(child.val()));
      if (moves.length === 0) return;

      LOG(`Replaying ${moves.length} historical moves for ${matchId}`);
      for (const msg of moves) {
        applyRelayMove(msg, game);
      }
    } catch (e) {
      ERR('replayMoveHistory failed', e);
    }
  }

  function applyRelayMove (msg, game) {
    if (!msg || !msg.type) return;
    if (msg.type === 'move') {
      if ((game === 'chess' || !game) && msg.fen && window.chessGame) {
        window.chessGame.load(msg.fen);
        if (msg.capturedW && window.chessUI) window.chessUI.capturedW = msg.capturedW;
        if (msg.capturedB && window.chessUI) window.chessUI.capturedB = msg.capturedB;
      } else if ((game === 'c4' || game === 'connect4') &&
                 typeof window.applyC4Move === 'function') {
        window.applyC4Move(msg.col, msg.side);
      } else if ((game === 'ck' || game === 'checkers') &&
                 typeof window.applyCkMove === 'function') {
        window.applyCkMove(msg.from, msg.to, msg.side);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. CHESS BOARD LAUNCHER
  // ─────────────────────────────────────────────────────────────────────────────
  function launchChessBoard (opts) {
    // Init chess engine if available
    if (window.Chess && !window.chessGame) {
      window.chessGame = new Chess();
    }

    const isFlipped = opts.side === 'b';
    const timeSec   = opts.time;

    // Build or replace chess overlay
    let overlay = document.getElementById('chessOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id        = 'chessOverlay';
    overlay.className = 'chess-overlay';

    const myLabel  = opts.side === 'w' ? 'White ♙' : 'Black ♟';
    const oppLabel = opts.side === 'w' ? 'Black ♟' : 'White ♙';
    const topLabel = isFlipped ? myLabel : oppLabel;
    const botLabel = isFlipped ? oppLabel : myLabel;

    overlay.innerHTML = `
      <div class="chess-container" style="max-width:520px;width:100%">
        <div class="chess-header">
          <h2>♟ Chess</h2>
          <button class="chess-close" onclick="window.resignMatch && window.resignMatch()">✕</button>
        </div>
        <div style="padding:8px 16px 0">
          <!-- Top player bar -->
          <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:#262421;border-radius:6px;margin-bottom:4px">
            <div style="width:32px;height:32px;border-radius:4px;background:#3a3a3a;display:flex;align-items:center;justify-content:center;font-size:18px">♟</div>
            <div style="flex:1;color:#e8e6e3;font-weight:600;font-size:13px">${topLabel}</div>
            <div id="htpClockTop" style="font-family:monospace;font-size:16px;font-weight:700;background:#3d3d3d;color:#e8e6e3;padding:3px 10px;border-radius:4px;min-width:60px;text-align:center">${fmtTime(timeSec)}</div>
          </div>

          <!-- Board -->
          <div id="htpChessBoard" style="
            display:grid;grid-template-columns:repeat(8,1fr);
            border:3px solid #404040;border-radius:2px;overflow:hidden;
            box-shadow:0 8px 32px rgba(0,0,0,.6);
            width:min(90vw,480px);height:min(90vw,480px);
          "></div>

          <!-- Bottom player bar -->
          <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:#262421;border-radius:6px;margin-top:4px">
            <div style="width:32px;height:32px;border-radius:4px;background:#3a3a3a;display:flex;align-items:center;justify-content:center;font-size:18px">♙</div>
            <div style="flex:1;color:#e8e6e3;font-weight:600;font-size:13px">${botLabel} (You)</div>
            <div id="htpClockBot" style="font-family:monospace;font-size:16px;font-weight:700;background:#e8e6e3;color:#1a1a1a;padding:3px 10px;border-radius:4px;min-width:60px;text-align:center">${fmtTime(timeSec)}</div>
          </div>

          <!-- Status + controls -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:0 2px">
            <div id="htpChessStatus" style="font-size:12px;color:#8a8a8a">Waiting for opponent…</div>
            <button class="chess-btn chess-btn-danger" onclick="window.resignMatch && window.resignMatch()" style="font-size:12px;padding:6px 18px">Resign</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Store state
    window.chessUI = window.chessUI || {};
    window.chessUI.playerColor   = opts.side;
    window.chessUI.isFlipped     = isFlipped;
    window.chessUI.capturedW     = [];
    window.chessUI.capturedB     = [];
    window.chessUI.selectedSq    = null;
    window.chessUI.timeLeft      = [timeSec, timeSec];
    window.chessUI.activeClock   = 'w'; // white moves first

    renderChessBoardFull();
    startChessClocks(opts);

    // Override chessSquareClick to relay moves with clock sync
    installChessMoveRelay(opts.id, opts.side);

    LOG(`Chess board opened for ${opts.id}, you are ${opts.side === 'w' ? 'White' : 'Black'}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. CHESS BOARD RENDERER (Chess.com style: eeeed2 / 769656)
  // ─────────────────────────────────────────────────────────────────────────────
  const PIECE_UNICODE = {
    wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
    bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
  };

  function renderChessBoardFull () {
    const el = document.getElementById('htpChessBoard');
    if (!el) return;

    const game    = window.chessGame;
    const ui      = window.chessUI || {};
    const flipped = ui.isFlipped || false;
    const selSq   = ui.selectedSq;
    const legalMv = ui.legalMoves || [];
    const lastMv  = ui.lastMove || null; // {from, to}

    const files  = ['a','b','c','d','e','f','g','h'];
    const ranks  = [8,7,6,5,4,3,2,1];
    const dFiles = flipped ? [...files].reverse() : files;
    const dRanks = flipped ? [...ranks].reverse() : ranks;

    let html = '';
    for (const rank of dRanks) {
      for (const file of dFiles) {
        const sq      = file + rank;
        const isLight = (files.indexOf(file) + rank) % 2 === 0;
        const piece   = game ? (game.get(sq) || null) : null;
        const pieceKey = piece ? (piece.color + piece.type.toUpperCase()) : null;
        const sym     = pieceKey ? (PIECE_UNICODE[pieceKey] || '') : '';

        const isLastMv  = lastMv && (sq === lastMv.from || sq === lastMv.to);
        const isSelected = sq === selSq;
        const isLegal    = legalMv.includes(sq);
        const isCapture  = isLegal && !!piece;

        let bg = isLight ? '#eeeed2' : '#769656';
        if (isLastMv)   bg = isLight ? '#cdd16e' : '#aaa23a';
        if (isSelected) bg = isLight ? '#f6f669' : '#baca44';

        // Piece color: white pieces = white text, black pieces = near-black
        let pieceStyle = '';
        if (piece) {
          if (piece.color === 'w') {
            pieceStyle = 'color:#ffffff;-webkit-text-stroke:1.5px #333;text-shadow:0 1px 3px rgba(0,0,0,.5)';
          } else {
            pieceStyle = 'color:#1a1a1a;-webkit-text-stroke:0.5px #555;text-shadow:0 1px 2px rgba(0,0,0,.3)';
          }
        }

        const legalDot = isLegal && !isCapture
          ? `<div style="position:absolute;width:28%;height:28%;border-radius:50%;background:rgba(0,0,0,.18);pointer-events:none"></div>` : '';
        const captureRing = isCapture
          ? `<div style="position:absolute;inset:0;border-radius:50%;border:4px solid rgba(0,0,0,.18);pointer-events:none"></div>` : '';

        html += `<div onclick="window.htpChessClick && window.htpChessClick('${sq}')"
          data-sq="${sq}"
          style="position:relative;display:flex;align-items:center;justify-content:center;
                 background:${bg};cursor:pointer;transition:filter .1s;aspect-ratio:1">
          ${legalDot}${captureRing}
          <span style="font-size:calc(min(90vw,480px)/8*.82);line-height:1;user-select:none;z-index:1;${pieceStyle}">${sym}</span>
        </div>`;
      }
    }
    el.innerHTML = html;

    // Update status bar
    const statusEl = document.getElementById('htpChessStatus');
    if (statusEl && game) {
      if (game.isCheckmate()) {
        statusEl.textContent = 'Checkmate!';
        statusEl.style.color = '#49e8c2';
      } else if (game.isCheck()) {
        statusEl.textContent = 'Check!';
        statusEl.style.color = '#ff6b6b';
      } else if (game.isDraw() || game.isStalemate()) {
        statusEl.textContent = 'Draw';
        statusEl.style.color = '#888';
      } else {
        const turn = game.turn() === (ui.playerColor || 'w');
        statusEl.textContent = turn ? 'Your turn' : "Opponent's turn";
        statusEl.style.color = turn ? '#49e8c2' : '#8a8a8a';
      }
    }
  }

  window.renderChessBoard = renderChessBoardFull;

  // Square click handler
  window.htpChessClick = function (sq) {
    const game = window.chessGame;
    const ui   = window.chessUI;
    if (!game || !ui) return;
    if (game.turn() !== ui.playerColor) return; // not your turn

    if (ui.selectedSq) {
      // Try move
      const prevFen = game.fen();
      const move = game.move({ from: ui.selectedSq, to: sq, promotion: 'q' });
      if (move) {
        ui.lastMove    = { from: ui.selectedSq, to: sq };
        ui.selectedSq  = null;
        ui.legalMoves  = [];
        // Relay move with clock sync
        if (typeof window.relaySend === 'function') {
          window.relaySend({
            type:       'move',
            game:       'chess',
            fen:        game.fen(),
            move:       { from: move.from, to: move.to, san: move.san },
            capturedW:  ui.capturedW,
            capturedB:  ui.capturedB,
            wasCapture: prevFen.split(' ')[0].length !== game.fen().split(' ')[0].length,
            // Clock sync: remaining time for both sides
            clockSync: { w: ui.timeLeft[0], b: ui.timeLeft[1], ts: Date.now() }
          });
        }
        // Switch active clock
        ui.activeClock = game.turn();
        renderChessBoardFull();
        // Check game over
        if (game.isCheckmate()) {
          const winner = game.turn() === 'w' ? 'b' : 'w'; // mated side is game.turn()
          if (typeof window.handleMatchGameOver === 'function') {
            window.handleMatchGameOver('checkmate', winner);
          }
        } else if (game.isDraw() || game.isStalemate()) {
          if (typeof window.handleMatchGameOver === 'function') {
            window.handleMatchGameOver('draw', null);
          }
        }
        return;
      }
      // Clicked another own piece — reselect
      ui.selectedSq = null;
      ui.legalMoves = [];
    }

    // Select piece
    const piece = game.get(sq);
    if (piece && piece.color === ui.playerColor) {
      ui.selectedSq  = sq;
      ui.legalMoves  = game.moves({ square: sq, verbose: true }).map(m => m.to);
    }
    renderChessBoardFull();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. CHESS CLOCK with sync support
  // ─────────────────────────────────────────────────────────────────────────────
  function startChessClocks (opts) {
    const ui = window.chessUI;
    if (ui.timerInterval) clearInterval(ui.timerInterval);

    ui.timerInterval = setInterval(() => {
      const game = window.chessGame;
      if (!game || ui.gameOver) { clearInterval(ui.timerInterval); return; }

      const activeIdx = ui.activeClock === 'w' ? 0 : 1;
      ui.timeLeft[activeIdx]--;

      if (ui.timeLeft[activeIdx] <= 0) {
        ui.timeLeft[activeIdx] = 0;
        ui.gameOver = true;
        clearInterval(ui.timerInterval);
        const loser  = ui.activeClock;
        const winner = loser === 'w' ? 'b' : 'w';
        if (typeof window.handleMatchGameOver === 'function') {
          window.handleMatchGameOver('timeout', winner);
        }
      }

      updateChessClocks(ui);
    }, 1000);
  }

  function updateChessClocks (ui) {
    const flipped = ui.isFlipped || false;
    const topClock = document.getElementById('htpClockTop');
    const botClock = document.getElementById('htpClockBot');
    if (!topClock || !botClock) return;

    const whiteTime = ui.timeLeft[0];
    const blackTime = ui.timeLeft[1];
    const topTime   = flipped ? whiteTime : blackTime;
    const botTime   = flipped ? blackTime : whiteTime;

    topClock.textContent = fmtTime(topTime);
    botClock.textContent = fmtTime(botTime);

    // Highlight active clock
    const activeIsTop = (flipped && ui.activeClock === 'w') ||
                        (!flipped && ui.activeClock === 'b');
    topClock.style.background = activeIsTop ? '#e8e6e3' : '#3d3d3d';
    topClock.style.color      = activeIsTop ? '#1a1a1a' : '#e8e6e3';
    botClock.style.background = activeIsTop ? '#3d3d3d' : '#e8e6e3';
    botClock.style.color      = activeIsTop ? '#e8e6e3' : '#1a1a1a';
  }

  // Handle incoming clockSync from relay
  function applyClockSync (msg) {
    if (!msg.clockSync || !window.chessUI) return;
    const { w, b } = msg.clockSync;
    if (typeof w === 'number') window.chessUI.timeLeft[0] = w;
    if (typeof b === 'number') window.chessUI.timeLeft[1] = b;
    updateChessClocks(window.chessUI);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. PATCH handleRelayMessage to apply clockSync and handle missed moves
  // ─────────────────────────────────────────────────────────────────────────────
  function patchRelayHandler () {
    const orig = window.handleRelayMessage;
    if (!orig || orig._boardEnginePatched) return;

    window.handleRelayMessage = function (msg) {
      if (msg && msg.clockSync) applyClockSync(msg);
      orig.call(this, msg);
      // After opponent move, refresh board
      if (msg && msg.type === 'move') {
        if (msg.game === 'chess' || !msg.game) {
          setTimeout(renderChessBoardFull, 50);
        }
      }
    };
    window.handleRelayMessage._boardEnginePatched = true;
    LOG('handleRelayMessage clock-sync patch installed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. CHESS MOVE RELAY installer (wraps chessSquareClick or htpChessClick)
  // ─────────────────────────────────────────────────────────────────────────────
  function installChessMoveRelay (matchId, myColor) {
    // Already handled inside htpChessClick above via relaySend
    // This installs the global renderChessOverlay alias if needed
    window.renderChessOverlay = renderChessBoardFull;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. CONNECT4 LAUNCHER (delegates to existing startConnect4Game with correct side)
  // ─────────────────────────────────────────────────────────────────────────────
  function launchConnect4Board (opts) {
    if (typeof window.startConnect4Game === 'function') {
      window.startConnect4Game({
        id:   opts.id,
        side: opts.side === 'w' ? 1 : 2, // 1=Red(first), 2=Yellow(second)
        time: opts.time,
        stake: opts.stake
      });
      LOG(`Connect4 board opened for ${opts.id}`);
    } else {
      ERR('startConnect4Game not available');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. CHECKERS LAUNCHER
  // ─────────────────────────────────────────────────────────────────────────────
  function launchCheckersBoard (opts) {
    if (typeof window.startCheckersGame === 'function') {
      window.startCheckersGame({
        id:   opts.id,
        side: opts.side === 'w' ? 1 : 3, // 1=Red(moves first), 3=Black
        time: opts.time,
        stake: opts.stake
      });
      LOG(`Checkers board opened for ${opts.id}`);
    } else {
      ERR('startCheckersGame not available');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  function fmtTime (s) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function parseTimeControl (str) {
    // "5+0", "5", "10+5", "90"
    const parts = String(str).split('+');
    const mins  = parseFloat(parts[0]) || 5;
    return Math.round(mins * 60);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BOOT — install all patches once WASM + Firebase are ready
  // ─────────────────────────────────────────────────────────────────────────────
  function boot () {
    patchJoinAmount();
    patchSendTxAmount();
    patchCreateForCreatorBoard();
    patchJoinForBoard();
    patchRelayHandler();
    LOG('All patches installed ✓');
  }

  // Wait for htpSendTx and joinLobbyMatch to exist before patching
  let attempts = 0;
  const waitForReady = setInterval(() => {
    attempts++;
    if (window.htpSendTx && window.joinLobbyMatch && window.createMatchWithLobby) {
      clearInterval(waitForReady);
      boot();
    }
    if (attempts > 60) { // 6 seconds timeout
      clearInterval(waitForReady);
      ERR('Timeout waiting for htpSendTx/joinLobbyMatch — patching anyway');
      boot();
    }
  }, 100);

  // Also re-run on WASM ready event
  window.addEventListener('htpWasmReady', () => {
    if (!window.htpSendTx._boardEnginePatched) boot();
  });

  LOG('Board Engine v1 loaded — Chess/Connect4/Checkers, creator+joiner boards, clocks synced');
})();
