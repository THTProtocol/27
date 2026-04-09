/**
 * htp-blockdag-viz.js - Live Kaspa BlockDAG Visualization (Canvas-based)
 *
 * Renders real block data from TN12 on HTML Canvas elements.
 * Polls blockdag stats every 5s, block data every 3s.
 */
(function(window) {
  'use strict';

  var STATS_INTERVAL = 5000;
  var BLOCKS_INTERVAL = 3000;
  var STATS_URL = 'https://api-tn12.kaspa.org/info/blockdag';
  // blocks endpoint requires lowHash; we fetch tip first, then use it
  var BLOCKS_BASE = 'https://api-tn12.kaspa.org/blocks';

  var BLOCK_W = 18;
  var BLOCK_H = 12;
  var BLOCK_R = 3;
  var PRIMARY = '#49e8c2';
  var PRIMARY_GLOW = 'rgba(73,232,194,0.6)';
  var BLOCK_FILL = '#0a1a14';
  var BG = '#010806';
  var LINE_COLOR = 'rgba(73,232,194,0.25)';
  var LABEL_COLOR = 'rgba(73,232,194,0.45)';

  // Ambient particles for full-page background mode
  var _particles = [];
  var _PARTICLE_COUNT = 60;

  function initParticles(w, h) {
    _particles = [];
    for (var i = 0; i < _PARTICLE_COUNT; i++) {
      _particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.2,
        alpha: 0.15 + Math.random() * 0.45,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function drawBackgroundMode(ctx, w, h) {
    // Transparent clear — page shows through
    ctx.clearRect(0, 0, w, h);
    var t = Date.now();

    // Draw drifting ambient particles (block nodes)
    _particles.forEach(function(p) {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.018;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      var alpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PRIMARY;
      ctx.shadowColor = PRIMARY;
      ctx.shadowBlur = 6;
      roundRect(ctx, p.x - p.r, p.y - p.r, p.r * 2 + 6, p.r * 2 + 4, 1);
      ctx.fill();
      ctx.restore();
    });

    // Draw faint connections between nearby particles
    ctx.save();
    for (var i = 0; i < _particles.length; i++) {
      for (var j = i + 1; j < _particles.length; j++) {
        var dx = _particles[i].x - _particles[j].x;
        var dy = _particles[i].y - _particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          ctx.globalAlpha = (1 - dist / 160) * 0.12;
          ctx.strokeStyle = PRIMARY;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(_particles[i].x + 4, _particles[i].y + 2);
          ctx.lineTo(_particles[j].x + 4, _particles[j].y + 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Overlay live blocks on top in the lower portion if we have data
    if (_blocks.length > 0) {
      drawLiveBlocksOverlay(ctx, w, h);
    }
  }

  var _blocks = [];
  var _blockMap = {};
  var _latestHash = null;
  var _statsTimer = null;
  var _blocksTimer = null;
  var _animFrames = [];
  var _tooltip = null;
  var _connected = false;

  // ── Stats Polling ──────────────────────────────────────────────────────

  function fetchStats() {
    fetch(STATS_URL).then(function(r) { return r.json(); }).then(function(data) {
      _connected = true;
      var el;
      el = document.getElementById('statBlockHeight') || document.getElementById('kaspaBlockHeight') || document.getElementById('ks-block-height');
      if (el) el.textContent = (data.blockCount || 0).toLocaleString();

      el = document.getElementById('statDaaScore') || document.getElementById('kaspaDaaScore') || document.getElementById('ks-daa-score');
      if (el) el.textContent = (data.virtualDaaScore || 0).toLocaleString();

      el = document.getElementById('statHashrate') || document.getElementById('kaspaHashrate') || document.getElementById('ks-hashrate');
      if (el) {
        var h = computeHashrate(data.difficulty || 0);
        el.textContent = h;
      }

      el = document.getElementById('statBlockRate') || document.getElementById('kaspaBlockRate') || document.getElementById('ks-block-rate');
      if (el) el.textContent = '10 bps';

      el = document.getElementById('statFee') || document.getElementById('kaspaFee') || document.getElementById('ks-fee');
      if (el) el.textContent = '~0.0001 KAS';
    }).catch(function() {
      _connected = false;
    });
  }

  function computeHashrate(difficulty) {
    if (!difficulty) return '--';
    var hr = difficulty * Math.pow(2, 32) / 1;
    if (hr >= 1e18) return (hr / 1e18).toFixed(2) + ' EH/s';
    if (hr >= 1e15) return (hr / 1e15).toFixed(2) + ' PH/s';
    if (hr >= 1e12) return (hr / 1e12).toFixed(2) + ' TH/s';
    if (hr >= 1e9) return (hr / 1e9).toFixed(2) + ' GH/s';
    if (hr >= 1e6) return (hr / 1e6).toFixed(2) + ' MH/s';
    return hr.toFixed(0) + ' H/s';
  }

  // ── Block Polling ──────────────────────────────────────────────────────

  function fetchBlocks() {
    // Step 1: get tip hash from blockdag info
    fetch(STATS_URL).then(function(r) { return r.json(); }).then(function(info) {
      var tipHash = info && info.tipHashes && info.tipHashes[0];
      if (!tipHash && info && info.sink) tipHash = info.sink;
      if (!tipHash) return;
      // Step 2: use tip as lowHash to get blocks
      var url = BLOCKS_BASE + '?lowHash=' + tipHash + '&includeBlocks=true&limit=20';
      return fetch(url).then(function(r) { return r.json(); });
    }).then(function(data) {
      if (!data || !data.blocks || !Array.isArray(data.blocks)) return;
      _connected = true;
      var incoming = data.blocks.map(function(b) {
        var hdr = b.header || {};
        return {
          hash: hdr.hash || '',
          parents: (hdr.parentsByLevel && hdr.parentsByLevel[0]) ? hdr.parentsByLevel[0] : [],
          blueScore: hdr.blueScore || 0,
          timestamp: parseInt(hdr.timestamp, 10) || 0,
          slideIn: 0
        };
      }).filter(function(b) { return b.hash; });

      // Sort by timestamp ascending (oldest first)
      incoming.sort(function(a, b) { return a.timestamp - b.timestamp; });

      // Mark new blocks for slide-in animation
      var oldMap = _blockMap;
      _blockMap = {};
      incoming.forEach(function(b) {
        if (!oldMap[b.hash]) {
          b.slideIn = 1; // animate from right
        } else {
          b.slideIn = 0;
        }
        _blockMap[b.hash] = b;
      });

      _blocks = incoming;
      if (_blocks.length > 0) {
        _latestHash = _blocks[_blocks.length - 1].hash;
      }
    }).catch(function() {
      _connected = false;
    });
  }

  // ── Canvas Rendering ───────────────────────────────────────────────────

  function drawLiveBlocksOverlay(ctx, w, h) {
    // Show live blocks as a flowing strip near the bottom of the full-page canvas
    var padding = 20;
    var stripH = 60;
    var stripY = h - stripH - padding;
    var usableW = w - padding * 2;
    var n = Math.min(_blocks.length, 30);
    var spacingX = n > 1 ? usableW / (n - 1) : 0;

    ctx.save();
    ctx.globalAlpha = 0.6;
    var posMap = {};
    _blocks.slice(-n).forEach(function(b, i) {
      var slideOffset = b.slideIn * 40;
      b.slideIn = Math.max(0, b.slideIn - 0.06);
      var bx = padding + i * spacingX + slideOffset;
      var yOff = ((parseInt(b.hash.substring(0, 4), 16) || 0) % 5 - 2) * 6;
      var by = stripY + 20 + yOff;
      posMap[b.hash] = { x: bx, y: by };

      // parent lines
      b.parents.forEach(function(ph) {
        var pp = posMap[ph];
        if (!pp) return;
        ctx.strokeStyle = 'rgba(73,232,194,0.18)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pp.x + BLOCK_W, pp.y + BLOCK_H / 2);
        ctx.lineTo(bx, by + BLOCK_H / 2);
        ctx.stroke();
      });

      var isLatest = b.hash === _latestHash;
      ctx.fillStyle = isLatest ? 'rgba(73,232,194,0.5)' : 'rgba(73,232,194,0.15)';
      ctx.strokeStyle = PRIMARY;
      ctx.lineWidth = isLatest ? 1.5 : 0.8;
      if (isLatest) {
        ctx.shadowColor = PRIMARY;
        ctx.shadowBlur = 8;
      }
      roundRect(ctx, bx, by, BLOCK_W, BLOCK_H, BLOCK_R);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  function drawDAG(ctx, w, h, isBackground) {
    if (isBackground) {
      // Full-page background: transparent, animated particles + live blocks
      drawBackgroundMode(ctx, w, h);
      return;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    if (!_blocks.length) {
      drawConnecting(ctx, w, h);
      return;
    }

    // Label
    ctx.save();
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LIVE KASPA BLOCKDAG', 10, 8);
    ctx.restore();

    var padding = 30;
    var usableW = w - padding * 2;
    var usableH = h - padding * 2;
    var n = _blocks.length;
    var spacingX = n > 1 ? usableW / (n - 1) : 0;
    var centerY = padding + usableH / 2;

    // Build position lookup for parent lines
    var posMap = {};
    _blocks.forEach(function(b, i) {
      var slideOffset = b.slideIn * 40;
      b.slideIn = Math.max(0, b.slideIn - 0.08);
      var bx = padding + i * spacingX + slideOffset;
      // Stagger Y slightly based on hash to show DAG structure
      var yOff = ((parseInt(b.hash.substring(0, 4), 16) || 0) % 5 - 2) * (BLOCK_H * 0.8);
      var by = centerY + yOff - BLOCK_H / 2;
      posMap[b.hash] = { x: bx, y: by };
    });

    // Draw parent lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    _blocks.forEach(function(b) {
      var pos = posMap[b.hash];
      if (!pos) return;
      b.parents.forEach(function(ph) {
        var ppos = posMap[ph];
        if (!ppos) return;
        ctx.beginPath();
        ctx.moveTo(ppos.x + BLOCK_W, ppos.y + BLOCK_H / 2);
        ctx.lineTo(pos.x, pos.y + BLOCK_H / 2);
        ctx.stroke();
      });
    });

    // Draw blocks
    _blocks.forEach(function(b) {
      var pos = posMap[b.hash];
      if (!pos) return;
      var isLatest = b.hash === _latestHash;

      // Glow for latest
      if (isLatest) {
        var pulse = 4 + 2 * Math.sin(Date.now() / 300);
        ctx.save();
        ctx.shadowColor = PRIMARY_GLOW;
        ctx.shadowBlur = pulse;
        ctx.fillStyle = PRIMARY_GLOW;
        roundRect(ctx, pos.x - 2, pos.y - 2, BLOCK_W + 4, BLOCK_H + 4, BLOCK_R + 1);
        ctx.fill();
        ctx.restore();
      }

      // Block rect
      ctx.fillStyle = isLatest ? PRIMARY_GLOW : BLOCK_FILL;
      ctx.strokeStyle = PRIMARY;
      ctx.lineWidth = isLatest ? 2 : 1;
      roundRect(ctx, pos.x, pos.y, BLOCK_W, BLOCK_H, BLOCK_R);
      ctx.fill();
      ctx.stroke();

      // Hash label on latest
      if (isLatest) {
        ctx.save();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        var label = b.hash.substring(0, 6) + '...' + b.hash.slice(-4);
        ctx.fillText(label, pos.x + BLOCK_W / 2, pos.y + BLOCK_H + 4);
        ctx.restore();
      }
    });
  }

  function drawConnecting(ctx, w, h) {
    var t = Date.now() / 1000;
    ctx.save();
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shimmer effect
    var shimmer = 0.4 + 0.3 * Math.sin(t * 2);
    ctx.fillStyle = 'rgba(226,232,240,' + shimmer.toFixed(2) + ')';
    ctx.fillText('Connecting to Kaspa network...', w / 2, h / 2);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  // ── Tooltip ────────────────────────────────────────────────────────────

  function setupTooltip(canvas) {
    canvas.addEventListener('click', function(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var mx = (e.clientX - rect.left) * scaleX;
      var my = (e.clientY - rect.top) * scaleY;

      var padding = 30;
      var usableW = canvas.width - padding * 2;
      var n = _blocks.length;
      var spacingX = n > 1 ? usableW / (n - 1) : 0;
      var centerY = padding + (canvas.height - padding * 2) / 2;

      var hit = null;
      _blocks.forEach(function(b, i) {
        var bx = padding + i * spacingX;
        var yOff = ((parseInt(b.hash.substring(0, 4), 16) || 0) % 5 - 2) * (BLOCK_H * 0.8);
        var by = centerY + yOff - BLOCK_H / 2;
        if (mx >= bx && mx <= bx + BLOCK_W && my >= by && my <= by + BLOCK_H) {
          hit = b;
        }
      });

      removeTooltip();
      if (hit) {
        showTooltip(e.clientX, e.clientY, hit);
      }
    });
  }

  function showTooltip(px, py, block) {
    removeTooltip();
    _tooltip = document.createElement('div');
    _tooltip.style.cssText = 'position:fixed;z-index:1000;background:#1a2235;border:1px solid rgba(79,152,163,0.4);color:#e2e8f0;padding:10px 14px;border-radius:8px;font-family:JetBrains Mono,monospace;font-size:12px;line-height:1.6;pointer-events:none;max-width:320px;';
    _tooltip.style.left = px + 12 + 'px';
    _tooltip.style.top = py + 12 + 'px';
    var ts = block.timestamp ? new Date(block.timestamp * 1000).toLocaleString() : '--';
    _tooltip.innerHTML =
      '<div style="color:#4f98a3;font-weight:600;margin-bottom:4px;">Block</div>' +
      '<div>Hash: ' + block.hash.substring(0, 12) + '...' + block.hash.slice(-6) + '</div>' +
      '<div>Timestamp: ' + ts + '</div>' +
      '<div>Parents: ' + block.parents.length + '</div>' +
      '<div>Blue Score: ' + (block.blueScore || '--') + '</div>';
    document.body.appendChild(_tooltip);
  }

  function removeTooltip() {
    if (_tooltip) {
      _tooltip.remove();
      _tooltip = null;
    }
  }

  // ── Animation Loop ─────────────────────────────────────────────────────

  function startLoop(canvas, isBackground) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Init ambient particles once for background mode
    if (isBackground) {
      var r = canvas.getBoundingClientRect();
      initParticles(r.width || window.innerWidth, r.height || window.innerHeight);
    }

    function tick() {
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      var needsRescale = canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr;
      if (needsRescale) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        if (isBackground) initParticles(rect.width, rect.height);
      }
      drawDAG(ctx, rect.width, rect.height, isBackground);
      var id = requestAnimationFrame(tick);
      canvas._animId = id;
    }

    tick();
    _animFrames.push(canvas);
  }

  function stopLoop(canvas) {
    if (canvas && canvas._animId) {
      cancelAnimationFrame(canvas._animId);
      canvas._animId = null;
    }
  }

  // ── Resize Handler ─────────────────────────────────────────────────────

  function handleResize() {
    _animFrames.forEach(function(canvas) {
      if (!canvas || !canvas.parentElement) return;
      var container = canvas.parentElement;
      canvas.style.width = container.clientWidth + 'px';
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────

  function init() {
    // Full-page background canvas — transparent animated particles + live DAG overlay
    var bgCanvas = document.getElementById('dagCanvas');
    if (bgCanvas) {
      bgCanvas.style.display = 'block';
      startLoop(bgCanvas, true); // background mode: transparent, no solid fill
    }

    // Panel canvases — solid dark background with DAG detail
    var mainCanvas = document.getElementById('dagCanvasFull') || document.getElementById('blockdag-canvas');
    var miniCanvas = document.getElementById('dagCanvasMini') || document.getElementById('overview-dag-canvas');

    if (mainCanvas) {
      mainCanvas.style.width = '100%';
      mainCanvas.style.display = 'block';
      startLoop(mainCanvas, false);
      setupTooltip(mainCanvas);
    }

    if (miniCanvas) {
      miniCanvas.style.width = '100%';
      miniCanvas.style.display = 'block';
      startLoop(miniCanvas, false);
      setupTooltip(miniCanvas);
    }

    // Start polling
    fetchStats();
    fetchBlocks();
    _statsTimer = setInterval(fetchStats, STATS_INTERVAL);
    _blocksTimer = setInterval(fetchBlocks, BLOCKS_INTERVAL);

    window.addEventListener('resize', handleResize);

    // Close tooltip on scroll/click elsewhere
    document.addEventListener('scroll', removeTooltip, true);

    console.log('[BlockDAG] Initialized');
  }

  // ── Public API ─────────────────────────────────────────────────────────

  window.htpBlockDAG = {
    init: init,
    startPolling: function() {
      if (!_statsTimer) _statsTimer = setInterval(fetchStats, STATS_INTERVAL);
      if (!_blocksTimer) _blocksTimer = setInterval(fetchBlocks, BLOCKS_INTERVAL);
    },
    stopPolling: function() {
      clearInterval(_statsTimer); _statsTimer = null;
      clearInterval(_blocksTimer); _blocksTimer = null;
      _animFrames.forEach(stopLoop);
      _animFrames = [];
    },
    getLatestBlockHash: function() { return _latestHash; },
    getBlockCount: function() { return _blocks.length; },
    isConnected: function() { return _connected; }
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[BlockDAG] Module loaded');

})(window);
