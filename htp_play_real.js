// Real HTP game player -- uses chess.js + REST API
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
    const url = new URL(BASE + path);
    const opts = { method, hostname: url.hostname, port: 443, path: url.pathname,
      headers: {'Content-Type': 'application/json'}, agent, rejectUnauthorized: false };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function playChessGame() {
  console.log('\n========== CHESS GAME ==========');
  
  // CREATE
  console.log('Creating game...');
  const create = await api('POST', '/api/games', {
    type: 'chess', stakeKas: 1, playerA: W1, playerAPubkey: W1PK, timeoutHours: 4
  });
  const gameId = create.game.id;
  console.log('Created:', gameId, 'status:', create.game.status);
  
  // JOIN
  await sleep(1);
  console.log('Joining...');
  const join = await api('POST', '/api/games/' + gameId + '/join', {
    playerB: W2, playerBPubkey: W2PK, simulate: true
  });
  console.log('Joined:', join.game.status, '(simulated:', join.simulated, ')');
  
  // PLAY REAL CHESS
  const chess = new Chess();
  let moveNum = 0;
  
  while (!chess.isGameOver() && moveNum < 80) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) break;
    
    // Pick a reasonable move (prefer captures, then random)
    const captures = moves.filter(m => m.flags.includes('c'));
    const move = captures.length > 0 ? captures[0] : moves[Math.floor(Math.random() * moves.length)];
    
    chess.move(move);
    moveNum++;
    const player = chess.turn() === 'w' ? W1 : W2;
    
    await api('POST', '/api/games/' + gameId + '/move', {
      from: move.from, to: move.to, piece: move.piece, fen: chess.fen(), player
    });
    
    if (moveNum <= 5 || moveNum % 10 === 0) {
      console.log('Move', moveNum, ':', move.from, '->', move.to, chess.fen().split(' ')[0].slice(0,20));
    }
    await sleep(1);
  }
  
  const result = chess.isCheckmate() ? 'checkmate' :
    chess.isDraw() ? 'draw' : 
    chess.isStalemate() ? 'stalemate' : 'resign';
  
  console.log('Game result:', result, 'Total moves:', moveNum);
  console.log('FEN:', chess.fen());
  
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? W2 : W1;
    const loser = chess.turn() === 'w' ? W1 : W2;
    console.log('Checkmate! Winner:', winner.slice(0,40));
    
    await api('POST', '/api/games/' + gameId + '/checkmate', {
      winner, loser, fen: chess.fen()
    });
    await sleep(1);
    
    const claim = await api('POST', '/api/games/' + gameId + '/claim', {});
    console.log('Claim:', claim.message || claim.txId);
    
    const game = await api('GET', '/api/games/' + gameId);
    console.log('Final status:', game.status, '| winner:', (game.winner||'').slice(0,40));
    console.log('Settle TX:', game.settleTxId);
  }
  
  return { gameId, result, moves: moveNum, fen: chess.fen() };
}

async function playAllGames() {
  console.log('=== HIGH TABLE PROTOCOL - REAL GAME TEST ===');
  console.log('Wallet 1:', W1.slice(0,40));
  console.log('Wallet 2:', W2.slice(0,40));
  
  // Health check
  const health = await api('GET', '/api/health');
  console.log('Server up:', health.uptime.toFixed(0), 'seconds');
  
  // Chess
  const chess = await playChessGame();
  
  // Stats after chess
  const stats = await api('GET', '/api/stats');
  console.log('\n=== STATS ===');
  console.log('Total games:', stats.totalGames);
  console.log('Active games:', stats.activeGames);
  console.log('Total users:', stats.totalUsers);
  
  // Leaderboard
  const lb = await api('GET', '/api/leaderboard');
  console.log('\n=== LEADERBOARD ===');
  lb.forEach(p => console.log(p.addr.slice(0,40), 'games:', p.totalGames, 'won:', p.gamesWon));
  
  // Games list
  const games = await api('GET', '/api/games');
  console.log('\n=== ALL GAMES ===');
  games.forEach(g => console.log(g.id.slice(0,25), g.type, g.status, g.winner ? 'has winner' : 'no winner', g.moves.length + ' moves'));
}

playAllGames().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
