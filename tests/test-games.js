'use strict';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.error('  ❌ ' + msg); }
}

console.log('\n══════════════════════════════════════════');
console.log('  HIGH TABLE — Game Logic Tests');
console.log('══════════════════════════════════════════\n');

// ─── Chess FEN Parsing ───────────────────────────────────
console.log('▸ Chess FEN Parsing');
{
  function parseFen(fen) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const rows = fen.split(' ')[0].split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const c of rows[r]) {
        if (c >= '1' && c <= '8') f += parseInt(c);
        else { board[r][f] = c; f++; }
      }
    }
    return board;
  }

  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const board = parseFen(startFen);
  assert(board[0][0] === 'r', 'a8 = black rook');
  assert(board[0][4] === 'k', 'e8 = black king');
  assert(board[7][4] === 'K', 'e1 = white king');
  assert(board[7][0] === 'R', 'a1 = white rook');
  assert(board[3][3] === null, 'd5 = empty');
  assert(board[1][0] === 'p', 'a7 = black pawn');
  assert(board[6][0] === 'P', 'a2 = white pawn');

  const e4Fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const board2 = parseFen(e4Fen);
  assert(board2[4][4] === 'P', 'e4 = white pawn after 1.e4');
  assert(board2[6][4] === null, 'e2 = empty after 1.e4');
}

// ─── Checkers Init ───────────────────────────────────────
console.log('\n▸ Checkers Board Init');
{
  function initCheckers() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++)
      for (let f = 0; f < 8; f++)
        if ((r + f) % 2 === 1) board[r][f] = { color: 'black', king: false };
    for (let r = 5; r < 8; r++)
      for (let f = 0; f < 8; f++)
        if ((r + f) % 2 === 1) board[r][f] = { color: 'red', king: false };
    return board;
  }

  const board = initCheckers();
  let blackCount = 0, redCount = 0;
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      if (board[r][f]?.color === 'black') blackCount++;
      if (board[r][f]?.color === 'red') redCount++;
    }
  assert(blackCount === 12, 'Black pieces: 12');
  assert(redCount === 12, 'Red pieces: 12');
  assert(board[0][1]?.color === 'black', 'b8 = black');
  assert(board[7][0]?.color === 'red', 'a1 = red');
  assert(board[4][0] === null, 'a4 = empty (middle row)');
}

// ─── Connect 4 Win Detection ─────────────────────────────
console.log('\n▸ Connect 4 Win Detection');
{
  function checkWin(board, r, c) {
    const rows = board.length, cols = board[0].length;
    const color = board[r][c];
    if (!color) return null;
    const directions = [[[0,1],[0,-1]], [[1,0],[-1,0]], [[1,1],[-1,-1]], [[1,-1],[-1,1]]];
    for (const [d1, d2] of directions) {
      const cells = [{ r, c }];
      for (const [dr, dc] of [d1, d2]) {
        let cr = r + dr, cc = c + dc;
        while (cr >= 0 && cr < rows && cc >= 0 && cc < cols && board[cr][cc] === color) {
          cells.push({ r: cr, c: cc }); cr += dr; cc += dc;
        }
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  }

  // Horizontal win
  const hBoard = Array.from({ length: 6 }, () => Array(7).fill(null));
  hBoard[5][0] = hBoard[5][1] = hBoard[5][2] = hBoard[5][3] = 'red';
  assert(checkWin(hBoard, 5, 1) !== null, 'Horizontal win detected');
  assert(checkWin(hBoard, 5, 1).length === 4, 'Horizontal: 4 cells');

  // Vertical win
  const vBoard = Array.from({ length: 6 }, () => Array(7).fill(null));
  vBoard[2][3] = vBoard[3][3] = vBoard[4][3] = vBoard[5][3] = 'yellow';
  assert(checkWin(vBoard, 4, 3) !== null, 'Vertical win detected');

  // Diagonal win (/)
  const dBoard = Array.from({ length: 6 }, () => Array(7).fill(null));
  dBoard[5][0] = dBoard[4][1] = dBoard[3][2] = dBoard[2][3] = 'red';
  assert(checkWin(dBoard, 3, 2) !== null, 'Diagonal / win detected');

  // Diagonal win (\)
  const d2Board = Array.from({ length: 6 }, () => Array(7).fill(null));
  d2Board[2][0] = d2Board[3][1] = d2Board[4][2] = d2Board[5][3] = 'yellow';
  assert(checkWin(d2Board, 4, 2) !== null, 'Diagonal \\ win detected');

  // No win
  const noWin = Array.from({ length: 6 }, () => Array(7).fill(null));
  noWin[5][0] = noWin[5][1] = noWin[5][2] = 'red';
  noWin[5][3] = 'yellow';
  assert(checkWin(noWin, 5, 1) === null, 'No win with 3 in a row');

  // Draw detection
  const fullBoard = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => (r + c) % 2 === 0 ? 'red' : 'yellow')
  );
  const isDraw = fullBoard[0].every(c => c !== null);
  assert(isDraw, 'Full board = draw');
}

// ─── Board State Serialization ───────────────────────────
console.log('\n▸ Board State Serialization');
{
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[0][1] = { color: 'black', king: false };
  board[7][0] = { color: 'red', king: true };

  const json = JSON.stringify(board);
  const parsed = JSON.parse(json);
  assert(parsed[0][1].color === 'black', 'Checkers serialization: black piece');
  assert(parsed[7][0].king === true, 'Checkers serialization: king flag');
  assert(parsed[4][4] === null, 'Checkers serialization: empty cell');

  const c4Board = Array.from({ length: 6 }, () => Array(7).fill(null));
  c4Board[5][3] = 'red';
  const c4Json = JSON.stringify(c4Board);
  const c4Parsed = JSON.parse(c4Json);
  assert(c4Parsed[5][3] === 'red', 'C4 serialization roundtrip');
}

console.log('\n══════════════════════════════════════════');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
