(function(){
'use strict';

/* ═══════════════════════════════════════════
   BACKGROUND — pure DAG, no text, right→left
   Clean squares, bezier edges, kaspa green
═══════════════════════════════════════════ */
function startBackground(){
  var canvas = document.getElementById('dagCanvas');
  if(!canvas){
    canvas = document.createElement('canvas');
    canvas.id = 'dagCanvas';
    document.body.prepend(canvas);
  }
  canvas.style.cssText = [
    'position:fixed','top:0','left:0',
    'width:100vw','height:100vh',
    'z-index:0','pointer-events:none','display:block'
  ].map(function(s){return s+'!important';}).join(';')+';';

  var ctx = canvas.getContext('2d');
  var W, H, DPR;

  /* config */
  var LANES    = 9;      /* horizontal swim lanes */
  var SZ       = 18;     /* block size px */
  var R        = 4;      /* corner radius */
  var GAP      = 90;     /* column spacing */
  var SPEED    = 0.55;   /* px per frame */
  var MAX_COLS = 28;

  var cols  = [];
  var edges = [];
  var nid   = 0;

  function laneY(l){ return H / (LANES + 1) * (l + 1); }

  function resize(){
    DPR = window.devicePixelRatio || 1;
    W   = window.innerWidth;
    H   = window.innerHeight;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* spawn a new column at x with 2–4 random lanes occupied */
  function spawnCol(atX){
    var all = [];
    for(var i = 0; i < LANES; i++) all.push(i);
    all.sort(function(){ return Math.random() - 0.5; });
    var count  = 2 + Math.floor(Math.random() * 3);
    var blocks = all.slice(0, count).map(function(lane){
      return { id: nid++, lane: lane, alpha: 0, pulse: Math.random() * 6.28 };
    });
    var col = { x: atX, blocks: blocks };
    cols.push(col);

    /* connect to previous column — each block links to 1–2 neighbours */
    if(cols.length > 1){
      var prev = cols[cols.length - 2];
      var ci   = cols.length - 1;
      blocks.forEach(function(b){
        var sorted = prev.blocks.slice().sort(function(a, bb){
          return Math.abs(a.lane - b.lane) - Math.abs(bb.lane - b.lane);
        });
        var pc = Math.min(1 + Math.floor(Math.random() * 2), sorted.length);
        for(var p = 0; p < pc; p++){
          edges.push({ fc: ci, fl: b.lane, tc: ci - 1, tl: sorted[p].lane });
        }
      });
    }
  }

  /* rounded rect path */
  function rrect(x, y, s, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+s-r, y); ctx.arcTo(x+s, y,   x+s, y+r,   r);
    ctx.lineTo(x+s, y+s-r); ctx.arcTo(x+s, y+s, x+s-r, y+s, r);
    ctx.lineTo(x+r, y+s); ctx.arcTo(x,   y+s, x,   y+s-r, r);
    ctx.lineTo(x,   y+r); ctx.arcTo(x,   y,   x+r, y,     r);
    ctx.closePath();
  }

  function draw(){
    requestAnimationFrame(draw);

    /* slow trail fade — creates ghost/depth effect */
    ctx.fillStyle = 'rgba(3,8,16,0.13)';
    ctx.fillRect(0, 0, W, H);

    /* scroll columns left */
    cols.forEach(function(col){
      col.x -= SPEED;
      col.blocks.forEach(function(b){
        if(b.alpha < 1) b.alpha = Math.min(1, b.alpha + 0.018);
        b.pulse += 0.015;
      });
    });

    /* spawn new column on right when gap opens */
    var last = cols[cols.length - 1];
    if(!last || last.x < W - GAP * 0.4){
      spawnCol((last ? last.x : W) + GAP);
    }

    /* cull columns that have scrolled off left */
    while(cols.length > 0 && cols[0].x < -SZ * 3){
      cols.shift();
      edges = edges.filter(function(e){
        e.fc--; e.tc--;
        return e.fc >= 0 && e.tc >= 0;
      });
    }

    /* draw edges first (behind blocks) */
    edges.forEach(function(e){
      var fc = cols[e.fc], tc = cols[e.tc];
      if(!fc || !tc) return;
      var fb = fc.blocks.find(function(b){ return b.lane === e.fl; });
      var tb = tc.blocks.find(function(b){ return b.lane === e.tl; });
      if(!fb || !tb) return;

      var ax = fc.x,          ay = laneY(e.fl);
      var bx = tc.x + SZ,     by = laneY(e.tl);
      var mx = (ax + bx) / 2;
      var a  = Math.min(fb.alpha, tb.alpha);

      /* chain blocks (same lane) get slightly brighter edge */
      var same = (e.fl === e.tl);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(mx, ay, mx, by, bx, by);
      ctx.strokeStyle = same
        ? 'rgba(57,255,170,' + (0.22 * a) + ')'
        : 'rgba(57,255,170,' + (0.10 * a) + ')';
      ctx.lineWidth = same ? 0.9 : 0.55;
      ctx.stroke();
    });

    /* draw blocks */
    cols.forEach(function(col){
      col.blocks.forEach(function(b){
        var x = col.x - SZ / 2;
        var y = laneY(b.lane) - SZ / 2;
        var a = b.alpha;
        var g = 0.42 + 0.28 * Math.sin(b.pulse);  /* gentle glow pulse */

        ctx.save();

        /* outer glow */
        ctx.shadowColor = 'rgba(57,255,170,' + (g * a * 0.7) + ')';
        ctx.shadowBlur  = 12;

        /* fill — very subtle so squares feel like voids */
        rrect(x, y, SZ, R);
        ctx.fillStyle = 'rgba(57,255,170,' + (0.04 * a) + ')';
        ctx.fill();

        /* border — the main visual */
        rrect(x, y, SZ, R);
        ctx.strokeStyle = 'rgba(57,255,170,' + (0.72 * a * g) + ')';
        ctx.lineWidth   = 1.0;
        ctx.stroke();

        ctx.restore();
      });
    });
  }

  /* init */
  resize();
  window.addEventListener('resize', resize);

  /* pre-fill screen so it's not empty on load */
  for(var x = GAP; x < W + GAP * 2; x += GAP) spawnCol(x);
  cols.forEach(function(c){ c.blocks.forEach(function(b){ b.alpha = 1; }); });

  draw();
}

/* boot */
function boot(){ startBackground(); }
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
