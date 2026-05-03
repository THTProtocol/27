// Comprehensive HTP game player - Chess, Connect4, Checkers
const http = require('https');
const { Chess } = require('chess.js');

const BASE = 'https://178.105.76.81';
const W1 = 'kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353';
const W1PK = '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa';
const W2 = 'kaspatest:qpw2yxrmfudv56lvav32s8jz6uwqhp2x0x7fna0640qx3gwp70d55uue9uecs';
const W2PK = '03746a1f8b9d3c7e5a4b2f1e0d8c9a6b7e5f4d3c2a1b0e9f8d7c6b5a4e3f2d1c';
const agent = new http.Agent({ rejectUnauthorized: false });

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const opts = { method, hostname: u.hostname, port: 443, path: u.pathname,
      headers: {'Content-Type': 'application/json'}, agent };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ==================== CHESS ====================
async function playChess() {
  const S = '  [CHESS]';
  console.log(S, 'Creating game...');
  const c = await api('POST', '/api/games', { type: 'chess', stakeKas: 1, playerA: W1, playerAPubkey: W1PK, timeoutHours: 4 });
  const gid = c.game.id;
  console.log(S, 'Created:', gid);

  await api('POST', '/api/games/' + gid + '/join', { playerB: W2, playerBPubkey: W2PK, simulate: true });
  console.log(S, 'Joined -> playing');

  const chess = new Chess();
  let mn = 0, checkmate = false;
  while (!chess.isGameOver() && mn < 200) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) break;
    const caps = moves.filter(m => m.flags.includes('c'));
    const checks = moves.filter(m => m.san.includes('+'));
    const sorted = [...(checks.length ? checks : caps.length ? caps : moves)];
    const move = sorted[0];
    chess.move(move);
    mn++;
    const pl = chess.turn() === 'w' ? W1 : W2;
    await api('POST', '/api/games/' + gid + '/move', { from: move.from, to: move.to, piece: move.piece, fen: chess.fen(), player: pl });
    if (mn <= 3 || mn % 15 === 0) console.log(S, 'Move', mn, move.from, move.to, chess.fen().split(' ')[0].slice(0, 25));
    if (chess.isCheckmate()) { checkmate = true; break; }
    await sleep(0.5);
  }

  if (checkmate) {
    const winner = chess.turn() === 'w' ? W2 : W1;
    const loser = chess.turn() === 'w' ? W1 : W2;
    console.log(S, 'CHECKMATE! Winner:', winner.slice(0,30));
    await api('POST', '/api/games/' + gid + '/checkmate', { winner, loser, fen: chess.fen() });
    await sleep(1);
    const cl = await api('POST', '/api/games/' + gid + '/claim', {});
    console.log(S, 'Claim:', cl.message || cl.txId);
  } else {
    console.log(S, 'No checkmate after', mn, 'moves, resigning player B');
    await api('POST', '/api/games/' + gid + '/resign', { player: W2 });
    await sleep(1);
    await api('POST', '/api/games/' + gid + '/claim', {});
  }
  const g = await api('GET', '/api/games/' + gid);
  console.log(S, 'DONE. Status:', g.status, 'Moves:', g.moves.length);
  return g;
}

// ==================== CONNECT4 ====================
class Connect4 {
  constructor() { this.board = Array.from({length:6}, () => Array(7).fill(0)); this.turn = 1; }
  drop(col) {
    for (let r = 5; r >= 0; r--) {
      if (this.board[r][col] === 0) { this.board[r][col] = this.turn; this.turn = this.turn === 1 ? 2 : 1; return { row: r, col }; }
    }
    return null;
  }
  checkWin(row, col) {
    const p = this.board[row][col]; if (!p) return false;
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr,dc] of dirs) {
      let c = 1;
      for (let i = 1; i < 4; i++) { const r=row+dr*i, c_=col+dc*i; if (r>=0&&r<6&&c_>=0&&c_<7&&this.board[r][c_]===p) c++; else break; }
      for (let i = 1; i < 4; i++) { const r=row-dr*i, c_=col-dc*i; if (r>=0&&r<6&&c_>=0&&c_<7&&this.board[r][c_]===p) c++; else break; }
      if (c >= 4) return true;
    }
    return false;
  }
  getMoves() { const m = []; for (let c = 0; c < 7; c++) if (this.board[0][c] === 0) m.push(c); return m; }
  toString() {
    let s = '';
    for (let r = 0; r < 6; r++) { s += '|'; for (let c = 0; c < 7; c++) s += (this.board[r][c] === 1 ? 'X' : this.board[r][c] === 2 ? 'O' : '.') + '|'; s += '\n'; }
    return s;
  }
}

async function playConnect4() {
  const S = '  [CONNECT4]';
  console.log(S, 'Creating game...');
  const c = await api('POST', '/api/games', { type: 'connect4', stakeKas: 1, playerA: W1, playerAPubkey: W1PK, timeoutHours: 4 });
  const gid = c.game.id;
  console.log(S, 'Created:', gid);

  await api('POST', '/api/games/' + gid + '/join', { playerB: W2, playerBPubkey: W2PK, simulate: true });
  console.log(S, 'Joined -> playing');

  const c4 = new Connect4();
  let mn = 0, won = false, winner = null;
  while (!won && mn < 42) {
    const moves = c4.getMoves();
    if (moves.length === 0) break;
    const col = moves[Math.floor(Math.random() * moves.length)];
    const res = c4.drop(col);
    mn++;
    const pl = c4.turn === 1 ? W2 : W1;
    const fen = 'c4:' + mn + ':' + col;
    await api('POST', '/api/games/' + gid + '/move', { from: 'col' + col, to: 'r' + res.row + 'c' + res.col, piece: c4.board[res.row][res.col] === 1 ? 'X' : 'O', fen, player: pl });
    if (c4.checkWin(res.row, res.col)) { won = true; winner = pl === W1 ? W2 : W1; }
    await sleep(0.3);
  }
  console.log(S, c4.toString().trim().split('\n').slice(0,6).join('\n'));

  if (won) {
    const loser = winner === W1 ? W2 : W1;
    console.log(S, 'WIN! Winner:', winner.slice(0,30));
    await api('POST', '/api/games/' + gid + '/checkmate', { winner, loser, fen: 'c4-win' });
    await sleep(1);
  } else {
    console.log(S, 'Draw, resigning player B');
    await api('POST', '/api/games/' + gid + '/resign', { player: W2 });
    await sleep(1);
  }
  await api('POST', '/api/games/' + gid + '/claim', {});
  const g = await api('GET', '/api/games/' + gid);
  console.log(S, 'DONE. Status:', g.status, 'Moves:', g.moves.length, 'Winner:', (g.winner||'').slice(0,30));
  return g;
}

// ==================== CHECKERS ====================
class Checkers {
  constructor() {
    this.board = Array.from({length: 8}, () => Array(8).fill(0));
    for (let r = 0; r < 3; r++) for (let c = (r%2); c < 8; c+=2) this.board[r][c] = 1;
    for (let r = 5; r < 8; r++) for (let c = (r%2); c < 8; c+=2) this.board[r][c] = 2;
    this.turn = 1;
  }
  getMoves() {
    const moves = [];
    const dir = this.turn === 1 ? 1 : -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] !== this.turn) continue;
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && this.board[nr][nc] === 0) moves.push({ from: [r,c], to: [nr,nc] });
          const jr = r + 2*dir, jc = c + 2*dc;
          if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && this.board[nr] && this.board[nr][nc] !== 0 && this.board[nr][nc] !== this.turn && this.board[jr][jc] === 0)
            moves.push({ from: [r,c], to: [jr,jc], capture: [nr,nc] });
        }
      }
    }
    return moves;
  }
  move(m) {
    const [fr,fc] = m.from, [tr,tc] = m.to;
    this.board[tr][tc] = this.board[fr][fc];
    this.board[fr][fc] = 0;
    if (m.capture) { const [cr,cc] = m.capture; this.board[cr][cc] = 0; }
    this.turn = this.turn === 1 ? 2 : 1;
  }
  piecesLeft(p) { let c = 0; for (let r=0;r<8;r++) for(let c_=0;c_<8;c_++) if(this.board[r][c_]===p)c++; return c; }
  toString() {
    let s = '';
    for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) s += (this.board[r][c] === 1 ? 'X' : this.board[r][c] === 2 ? 'O' : '.') + ' '; s += '\n'; }
    return s;
  }
}

async function playCheckers() {
  const S = '  [CHECKERS]';
  console.log(S, 'Creating game...');
  const c = await api('POST', '/api/games', { type: 'checkers', stakeKas: 1, playerA: W1, playerAPubkey: W1PK, timeoutHours: 4 });
  const gid = c.game.id;
  console.log(S, 'Created:', gid);

  await api('POST', '/api/games/' + gid + '/join', { playerB: W2, playerBPubkey: W2PK, simulate: true });
  console.log(S, 'Joined -> playing');

  const ck = new Checkers();
  let mn = 0;
  while (ck.piecesLeft(1) > 0 && ck.piecesLeft(2) > 0 && mn < 100) {
    const moves = ck.getMoves();
    if (moves.length === 0) break;
    const caps = moves.filter(m => m.capture);
    const m = caps.length ? caps[0] : moves[Math.floor(Math.random() * moves.length)];
    ck.move(m);
    mn++;
    const pl = ck.turn === 1 ? W2 : W1;
    await api('POST', '/api/games/' + gid + '/move', {
      from: m.from.join(','), to: m.to.join(','), piece: 'checker', fen: 'ck:' + mn, player: pl
    });
    if (mn <= 3 || mn % 10 === 0) console.log(S, 'Move', mn, m.from, '->', m.to, m.capture ? 'CAPTURE!' : '');
    await sleep(0.3);
  }
  console.log(S, ck.toString());

  const p1 = ck.piecesLeft(1), p2 = ck.piecesLeft(2);
  if (p1 === 0) {
    console.log(S, 'Player 2 wins!');
    await api('POST', '/api/games/' + gid + '/checkmate', { winner: W2, loser: W1, fen: 'ck-win' });
  } else if (p2 === 0) {
    console.log(S, 'Player 1 wins!');
    await api('POST', '/api/games/' + gid + '/checkmate', { winner: W1, loser: W2, fen: 'ck-win' });
  } else {
    console.log(S, 'No decisive result, resigning');
    await api('POST', '/api/games/' + gid + '/resign', { player: W2 });
  }
  await sleep(1);
  await api('POST', '/api/games/' + gid + '/claim', {});
  const g = await api('GET', '/api/games/' + gid);
  console.log(S, 'DONE. Status:', g.status, 'Moves:', g.moves.length, 'Winner:', (g.winner||'').slice(0,30));
  return g;
}

// ==================== MAIN ====================
async function main() {
  console.log('============================================================');
  console.log('  HIGH TABLE PROTOCOL - REAL GAME TESTS');
  console.log('  W1:', W1.slice(0,45));
  console.log('  W2:', W2.slice(0,45));
  console.log('============================================================');

  const h = await api('GET', '/api/health');
  console.log('\nServer uptime:', h.uptime.toFixed(0) + 's');

  // Play all 3 games
  const chess = await playChess();
  const c4 = await playConnect4();
  const ck = await playCheckers();

  // Final stats
  console.log('\n============================================================');
  console.log('  FINAL RESULTS');
  console.log('============================================================');
  const stats = await api('GET', '/api/stats');
  console.log('Total games:', stats.totalGames);
  console.log('Active games:', stats.activeGames);
  console.log('Total users:', stats.totalUsers);
  console.log();
  const lb = await api('GET', '/api/leaderboard');
  lb.forEach(p => console.log(p.addr.slice(0,40), '| games:', p.totalGames, '| won:', p.gamesWon));

  const games = await api('GET', '/api/games');
  console.log('\nAll games:');
  games.forEach(g => console.log('  ' + g.id.slice(0,25), g.type.padEnd(9), g.status.padEnd(9), g.moves.length + ' moves', g.winner ? 'WINNER: ' + g.winner.slice(0,25) : ''));
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
