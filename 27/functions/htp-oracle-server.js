const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { Chess } = require('chess.js');

admin.initializeApp();
const db = admin.database();

// Oracle key — set via: firebase functions:secrets:set HTP_ORACLE_PRIV_KEY
// (requires Blaze plan). Falls back to env config for Spark plan.
function getOracleKey() {
  return process.env.HTP_ORACLE_PRIV_KEY
    || (functions.config().oracle || {}).priv_key
    || null;
}

function signResult(matchId, winner, reason) {
  const key = getOracleKey();
  if (!key) return null;
  const payload = matchId + ':' + winner + ':' + reason;
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

// ── Chess move validator ──────────────────────────────────────────────────
exports.validateChessMove = functions.https.onCall(async (data, context) => {
  const { matchId, pgn, move, playerId } = data;
  if (!matchId || !move) return { valid: false, error: 'Missing matchId or move' };

  const game = new Chess();
  if (pgn) {
    try { game.loadPgn(pgn); } catch(e) { return { valid: false, error: 'Invalid PGN' }; }
  }

  const result = game.move(move);
  if (!result) return { valid: false, error: 'Illegal move: ' + move };

  const response = {
    valid: true,
    fen: game.fen(),
    pgn: game.pgn(),
    move: result,
    gameOver: game.isGameOver(),
    inCheck: game.inCheck(),
    inCheckmate: game.isCheckmate(),
    inDraw: game.isDraw(),
    inStalemate: game.isStalemate(),
    winner: null,
    reason: null,
    signature: null
  };

  if (game.isGameOver()) {
    if (game.isCheckmate()) {
      // game.turn() returns the LOSER (side to move who is mated)
      response.winner = (game.turn() === 'b') ? 'white' : 'black';
      response.reason = 'checkmate';
    } else if (game.isDraw()) {
      response.winner = 'draw';
      response.reason = game.isStalemate() ? 'stalemate' : 'draw';
    }

    if (response.winner && matchId) {
      response.signature = signResult(matchId, response.winner, response.reason);
      await db.ref('settlement/' + matchId + '/pending').set({
        winner: response.winner,
        reason: response.reason,
        signature: response.signature,
        decidedAt: Date.now(),
        pgn: game.pgn()
      });
    }
  }

  // Write validated move to Firebase
  await db.ref('relay/' + matchId + '/moves').push({
    player: playerId,
    move: result.san,
    fen: game.fen(),
    ts: Date.now(),
    validated: true
  });

  return response;
});

// ── Connect4 move validator ───────────────────────────────────────────────
exports.validateConnect4Move = functions.https.onCall(async (data, context) => {
  const { matchId, board, col, player, playerId } = data;
  if (typeof col === 'undefined' || !board || !player) {
    return { valid: false, error: 'Missing col, board, or player' };
  }

  const ROWS = 6, COLS = 7;

  // Find lowest empty row in column
  let row = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) { row = r; break; }
  }
  if (row === -1) return { valid: false, error: 'Column full' };

  // Place piece
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = player;

  // Check win — all 4 directions
  function checkWin(b, p) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] !== p) continue;
        for (const [dr,dc] of dirs) {
          let count = 1;
          for (let i = 1; i < 4; i++) {
            const nr = r + dr*i, nc = c + dc*i;
            if (nr<0||nr>=ROWS||nc<0||nc>=COLS||b[nr][nc]!==p) break;
            count++;
          }
          if (count >= 4) return true;
        }
      }
    }
    return false;
  }

  const won = checkWin(newBoard, player);
  const full = newBoard[0].every(c => c !== null && c !== 0 && c !== '');
  const draw = !won && full;

  const response = {
    valid: true,
    board: newBoard,
    row,
    col,
    player,
    gameOver: won || draw,
    winner: won ? player : (draw ? 'draw' : null),
    reason: won ? 'connect4' : (draw ? 'draw' : null),
    signature: null
  };

  if (response.gameOver && matchId) {
    response.signature = signResult(matchId, String(response.winner), response.reason);
    await db.ref('settlement/' + matchId + '/pending').set({
      winner: response.winner,
      reason: response.reason,
      signature: response.signature,
      decidedAt: Date.now()
    });
  }

  await db.ref('relay/' + matchId + '/moves').push({
    player: playerId,
    col, row,
    ts: Date.now(),
    validated: true
  });

  return response;
});

// ── Resign handler ────────────────────────────────────────────────────────
exports.processResign = functions.https.onCall(async (data, context) => {
  const { matchId, resigningAddress } = data;
  if (!matchId || !resigningAddress) return { success: false, error: 'Missing params' };

  // Read match to find opponent (winner)
  const snap = await db.ref('matches/' + matchId).get();
  if (!snap.exists()) return { success: false, error: 'Match not found' };
  const match = snap.val();
  const players = match.players || {};
  const winner = (players.creatorAddrFull === resigningAddress)
    ? players.opponentAddrFull
    : players.creatorAddrFull;

  if (!winner) return { success: false, error: 'Cannot determine winner' };

  const sig = signResult(matchId, winner, 'resign');
  await db.ref('settlement/' + matchId + '/pending').set({
    winner,
    reason: 'resign',
    signature: sig,
    resignedBy: resigningAddress,
    decidedAt: Date.now()
  });
  await db.ref('relay/' + matchId + '/result').set({
    type: 'resign',
    reason: 'resign',
    resignedBy: resigningAddress,
    winner,
    ts: Date.now()
  });
  await db.ref('matches/' + matchId + '/info/status').set('resigned');

  return { success: true, winner, signature: sig };
});

// ── Settlement daemon trigger ────────────────────────────────────────────
exports.onSettlementPending = functions.database
  .ref('settlement/{matchId}/pending')
  .onCreate(async (snap, context) => {
    const { matchId } = context.params;
    const data = snap.val();
    console.log('[HTP Oracle] Settlement pending:', matchId, data.winner, data.reason);
    // Clients watch this path and call settleMatchPayout themselves
    // Oracle just ensures the record exists and is signed
    return null;
  });
