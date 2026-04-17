/**
 * htp-preview-fix.js - Game Preview Enhancement
 * Improves visual quality of skill game preview cards
 * Implements missing htpGamePreviewBoard function
 * Enhances chess piece visibility with Lichess SVG pieces
 */
;(function(){
'use strict';
const LOG=(...a)=>console.log('[HTP Preview Fix]',...a);

// Lichess piece SVG base URL
const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
const PIECE_MAP={
  K:'wK.svg',Q:'wQ.svg',R:'wR.svg',B:'wB.svg',N:'wN.svg',P:'wP.svg',
  k:'bK.svg',q:'bQ.svg',r:'bR.svg',b:'bB.svg',n:'bN.svg',p:'bP.svg'
};

// Starting position
const START_POS=[
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
];

function injectCSS(){
  const s=document.createElement('style');
  s.textContent=`
    .sgv2-board{height:280px!important}
    .sgv2-board svg{height:240px!important;width:auto!important}
    .sgv2-card{transition:transform .25s,box-shadow .25s}
    .sgv2-card:hover{transform:translateY(-6px);box-shadow:0 12px 40px rgba(73,232,194,0.18)}
    .sgv2-card .sgv2-board::after{opacity:0!important}
    .chess-preview-grid{display:grid;grid-template-columns:repeat(8,1fr);width:240px;height:240px;border-radius:6px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.4)}
    .chess-preview-sq{display:flex;align-items:center;justify-content:center;position:relative}
    .chess-preview-sq.light{background:#f0d9b5}
    .chess-preview-sq.dark{background:#b58863}
    .chess-preview-sq img{width:85%;height:85%;object-fit:contain;filter:drop-shadow(1px 1px 1px rgba(0,0,0,0.3))}
    .c4-preview-board{display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(6,1fr);width:210px;height:180px;background:#1565c0;border-radius:10px;padding:6px;gap:3px;box-shadow:0 4px 20px rgba(0,0,0,0.4)}
    .c4-preview-slot{background:rgba(0,0,0,0.25);border-radius:50%;aspect-ratio:1}
    .c4-preview-slot.red{background:#ef4444}
    .c4-preview-slot.yellow{background:#fbbf24}
    .ck-preview-board{display:grid;grid-template-columns:repeat(8,1fr);width:220px;height:220px;border-radius:6px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.4)}
    .ck-preview-sq{display:flex;align-items:center;justify-content:center}
    .ck-preview-sq.light{background:#f0d9b5}
    .ck-preview-sq.dark{background:#b58863}
    .ck-piece{width:70%;height:70%;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)}
    .ck-piece.teal{background:#49e8c2;border:2px solid #3bc4a3}
    .ck-piece.red{background:#ef4444;border:2px solid #dc2626}
    .ttt-preview-board{display:grid;grid-template-columns:repeat(3,1fr);width:180px;height:180px;gap:4px;padding:10px;background:rgba(73,232,194,0.08);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3)}
    .ttt-preview-cell{display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);border-radius:6px;font-size:36px;font-weight:700;color:#49e8c2}
    .ttt-preview-cell.x{color:#49e8c2}
    .ttt-preview-cell.o{color:#ef4444}
  `;
  document.head.appendChild(s);
}

function buildChessPreview(){
  const grid=document.createElement('div');
  grid.className='chess-preview-grid';
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq=document.createElement('div');
      sq.className='chess-preview-sq '+((r+c)%2===0?'light':'dark');
      const pc=START_POS[r][c];
      if(pc){
        const img=document.createElement('img');
        img.src=PIECE_BASE+PIECE_MAP[pc];
        img.alt=pc;
        img.loading='lazy';
        sq.appendChild(img);
      }
      grid.appendChild(sq);
    }
  }
  return grid;
}

function buildC4Preview(){
  const board=document.createElement('div');
  board.className='c4-preview-board';
  // Partial game state for visual interest
  const state=[
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,2,0,0,0],
    [0,0,1,1,0,0,0],
    [0,2,2,1,0,1,0],
    [1,1,2,2,1,2,1]
  ];
  for(let r=0;r<6;r++){
    for(let c=0;c<7;c++){
      const slot=document.createElement('div');
      slot.className='c4-preview-slot'+(state[r][c]===1?' red':state[r][c]===2?' yellow':'');
      board.appendChild(slot);
    }
  }
  return board;
}

function buildCheckersPreview(){
  const board=document.createElement('div');
  board.className='ck-preview-board';
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq=document.createElement('div');
      sq.className='ck-preview-sq '+((r+c)%2===0?'light':'dark');
      if((r+c)%2===1){
        if(r<3){
          const p=document.createElement('div');
          p.className='ck-piece red';
          sq.appendChild(p);
        }else if(r>4){
          const p=document.createElement('div');
          p.className='ck-piece teal';
          sq.appendChild(p);
        }
      }
      board.appendChild(sq);
    }
  }
  return board;
}

function buildTTTPreview(){
  const board=document.createElement('div');
  board.className='ttt-preview-board';
  const state=['X','O','',  'O','X','',  '','','X'];
  for(let i=0;i<9;i++){
    const cell=document.createElement('div');
    cell.className='ttt-preview-cell'+(state[i]==='X'?' x':state[i]==='O'?' o':'');
    cell.textContent=state[i];
    board.appendChild(cell);
  }
  return board;
}

function replacePreview(card,builder){
  const boardDiv=card.querySelector('.sgv2-board');
  if(!boardDiv)return;
  // Clear old SVG content
  boardDiv.innerHTML='';
  boardDiv.appendChild(builder());
}

function enhancePreviews(){
  const cards=document.querySelectorAll('.sgv2-card');
  if(cards.length<4){LOG('Cards not ready, retrying...');return false;}
  // Chess = first card, C4 = second, Checkers = third, TTT = fourth
  replacePreview(cards[0],buildChessPreview);
  replacePreview(cards[1],buildC4Preview);
  replacePreview(cards[2],buildCheckersPreview);
  replacePreview(cards[3],buildTTTPreview);
  LOG('All game previews enhanced');
  return true;
}

// Also implement the missing htpGamePreviewBoard
window.htpGamePreviewBoard=function(game,container){
  if(!container)return;
  container.innerHTML='';
  switch((game||'').toLowerCase()){
    case 'chess':container.appendChild(buildChessPreview());break;
    case 'c4':case 'connect4':container.appendChild(buildC4Preview());break;
    case 'ck':case 'checkers':container.appendChild(buildCheckersPreview());break;
    case 'ttt':case 'tictactoe':container.appendChild(buildTTTPreview());break;
  }
};

function boot(){
  injectCSS();
  let tries=0;
  const iv=setInterval(()=>{
    tries++;
    if(enhancePreviews()||tries>30)clearInterval(iv);
  },500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

LOG('Preview fix loaded');
})();
