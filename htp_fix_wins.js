// Fix win counts + fresh game test
const http = require('https');
const agent = new http.Agent({ rejectUnauthorized: false });

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request('https://localhost' + path, { method, headers: {'Content-Type':'application/json'}, agent }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){resolve(d)}});
    });
    req.on('error', reject);
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('--- FRESH GAME + WIN TRACKING TEST ---');
  
  // Create
  const c = await api('POST','/api/games', { type:'chess', stakeKas:1,
    playerA: 'kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353',
    playerAPubkey: '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
    timeoutHours: 4 });
  const gid = c.game.id;
  console.log('Created:', gid);

  // Join
  await api('POST','/api/games/'+gid+'/join', {
    playerB: 'kaspatest:qpw2yxrmfudv56lvav32s8jz6uwqhp2x0x7fna0640qx3gwp70d55uue9uecs',
    playerBPubkey: '03746a1f8b9d3c7e5a4b2f1e0d8c9a6b7e5f4d3c2a1b0e9f8d7c6b5a4e3f2d1c',
    simulate: true });
  console.log('Joined');

  // Resign player B -> player A wins
  await api('POST','/api/games/'+gid+'/resign', { 
    player: 'kaspatest:qpw2yxrmfudv56lvav32s8jz6uwqhp2x0x7fna0640qx3gwp70d55uue9uecs' });
  console.log('Resigned');

  // Claim -- should now trigger settlement + win increment
  const claim = await api('POST','/api/games/'+gid+'/claim', {});
  console.log('Claim:', claim.message || claim.txId);

  await new Promise(r=>setTimeout(r,1000));

  // Verify
  const lb = await api('GET','/api/leaderboard');
  console.log('\nLeaderboard:');
  let winsFound = false;
  lb.forEach(p => {
    const w = p.gamesWon;
    console.log('  ' + p.addr.slice(0,40) + ' games:' + p.totalGames + ' won:' + w);
    if (w > 0) winsFound = true;
  });

  console.log('\nWin tracking', winsFound ? 'WORKING!' : 'STILL BROKEN');

  // Also verify the game object
  const g = await api('GET','/api/games/'+gid);
  console.log('Game status:', g.status, 'winner:', (g.winner||'').slice(0,30));

  // Check settlement details
  console.log('\nSettlement for game:', gid);
  // Try GET payout
  const payout = await api('GET','/api/games/'+gid+'/payout');
  console.log('Payout:', JSON.stringify(payout));
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
