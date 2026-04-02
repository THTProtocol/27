/**
 * htp-blockdag-viz.js - Live Kaspa BlockDAG Visualization (Canvas-based)
 * Renders real block data from TN12 on HTML Canvas elements.
 */
(function() {
  'use strict';

  var API_BASE = 'https://api-tn12.kaspa.org';
  var BLOCK_POLL_MS = 3000;
  var STATS_POLL_MS = 5000;
  var BLOCK_W = 18;
  var BLOCK_H = 12;
  var BLOCK_R = 3;
  var PRIMARY = '#4f98a3';
  var PRIMARY_GLOW = 'rgba(79,152,163,0.6)';
  var BLOCK_FILL = '#0f1623';
  var BG = '#0a0e1a';

  var _blocks = [];
  var _blockMap = {};
  var _latestHash = null;
  var _tooltip = null;
  var _tooltipBlock = null;
  var _animId = null;
  var _blockTimer = null;
  var _statsTimer = null;
  var _canvases = [];
  var _slideOffset = 0;

  /* ── Utility ─────────────────────────────────────────────── */

  function formatHash(h) {
    if (!h || h.length < 8) return h || '';
    return h.substring(0, 6) + '...' + h.slice(-4);
  }

  function formatNumber(n) {
    if (n === undefined || n === null) return '--';
    return Number(n).toLocaleString();
  }

  function formatHashrate(difficulty) {
    if (!difficulty) return '--';
    var hr = difficulty * Math.pow(2, 32) / 1;
    if (hr >= 1e18) return (hr / 1e18).toFixed(2) + ' EH/s';
    if (hr >= 1e15) return (hr / 1e15).toFixed(2) + ' PH/s';
    if (hr >= 1e12) return (hr / 1e12).toFixed(2) + ' TH/s';
    if (hr >= 1e9) return (hr / 1e9).toFixed(2) + ' GH/s';
    if (hr >= 1e6) return (hr / 1e6).toFixed(2) + ' MH/s';
    return hr.toFixed(0) + ' H/s';
  }

  /* ── Stats Fetching ──────────────────────────────────────── */

  async function fetchStats() {
    try {
      var resp = await fetch(API_BASE + '/info/blockdag');
      if (!resp.ok) return;
      var data = await resp.json();

      var el;
      el = document.getElementById('kaspaBlockHeight');
      if (el) el.textContent = formatNumber(data.blockCount);

      el = document.getElementById('kaspaDaaScore');
      if (el) el.textContent = formatNumber(data.virtualDaaScore);

      el = document.getElementById('kaspaHashrate');
      if (el) el.textContent = formatHashrate(data.difficulty);

      el = document.getElementById('kaspaBlockRate');
      if (el) el.textContent = data.tipHashes ? (data.tipHashes.length > 1 ? data.tipHashes.length + ' bps' : '1 bps') : '-- bps';

      el = document.getElementById('kaspaFee');
      if (el) el.textContent = '~0.0001 KAS';
    } catch (e) {
      console.warn('[BlockDAG] Stats fetch error:', e.message);
    }
  }

  /* ── Block Fetching ──────────────────────────────────────── */

  async function fetchBlocks() {
    try {
      var resp = await fetch(API_BASE + '/blocks?limit=20&includeBlocks=true');
      if (!resp.ok) return;
      var data = await resp.json();
      if (!data || !data.blocks || !Array.isArray(data.blocks)) return;

      var newBlocks = data.blocks.map(function(b) {
        var hdr = b.header || {};
        var hash = hdr.hash || b.hash || '';
        var parents = [];
        if (hdr.parentsByLevel && Array.isArray(hdr.parentsByLevel) && hdr.parentsByLevel.length > 0) {
          parents = hdr.parentsByLevel[0] || [];
        }
        return {
          hash: hash,
          parents: parents,
          blueScore: hdr.blueScore || 0,
          timestamp: parseInt(hdr.timestamp || '0', 10),
          x: 0, y: 0, targetX: 0,
          isNew: !_blockMap[hash]
        };
      });

      // Sort by timestamp ascending (oldest left, newest right)
      newBlocks.sort(function(a, b) { return a.timestamp - b.timestamp; });

      // Detect truly new blocks for slide animation
      var hasNew = false;
      newBlocks.forEach(function(b) {
        if (b.isNew) hasNew = true;
        _blockMap[b.hash] = true;
      });
      if (hasNew && _blocks.length > 0) {
        _slideOffset = 40;
      }

      _blocks = newBlocks;
      if (_blocks.length > 0) {
        _latestHash = _blocks[_blocks.length - 1].hash;
      }
    } catch (e) {
      console.warn('[BlockDAG] Blocks fetch error:', e.message);
    }
  }

  /* ── Canvas Rendering ────────────────────────────────────── */

  function drawDAG(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var w = canvas.width;
    var h = canvas.height;
    var isMini = h <= 200;

    // Clear
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Label
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('KASPA BLOCKDAG', 10, 16);

    if (_blocks.length === 0) {
      drawConnecting(ctx, w, h);
      return;
    }

    // Animate slide offset
    if (_slideOffset > 0) {
      _slideOffset = Math.max(0, _slideOffset - 2);
    }

    var padding = 30;
    var usableW = w - padding * 2;
    var count = _blocks.length;
    var spacing = Math.min(usableW / Math.max(count - 1, 1), 60);
    var centerY = h / 2;

    // Assign positions
    _blocks.forEach(function(block, idx) {
      block.targetX = padding + idx * spacing + _slideOffset;
      // Stagger Y based on hash to show DAG structure
      var hashByte = parseInt(block.hash.substring(0, 2), 16) || 0;
      var yOffset = ((hashByte % 5) - 2) * (isMini ? 8 : 14);
      block.x = block.targetX;
      block.y = centerY + yOffset;
    });

    // Draw parent lines
    ctx.strokeStyle = 'rgba(79,152,163,0.3)';
    ctx.lineWidth = 1;
    _blocks.forEach(function(block) {
      block.parents.forEach(function(parentHash) {
        var parent = _blocks.find(function(b) { return b.hash === parentHash; });
        if (parent) {
          ctx.beginPath();
          ctx.moveTo(block.x, block.y + BLOCK_H / 2);
          ctx.lineTo(parent.x + BLOCK_W, parent.y + BLOCK_H / 2);
          ctx.stroke();
        }
      });
    });

    // Draw blocks
    _blocks.forEach(function(block) {
      var isLatest = block.hash === _latestHash;

      // Glow for latest
      if (isLatest) {
        var pulse = 0.3 + 0.2 * Math.sin(Date.now() / 400);
        ctx.shadowColor = PRIMARY;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PRIMARY_GLOW;
        roundRect(ctx, block.x - 2, block.y - 2, BLOCK_W + 4, BLOCK_H + 4, BLOCK_R + 1);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Block rect
      ctx.fillStyle = isLatest ? PRIMARY_GLOW : BLOCK_FILL;
      ctx.strokeStyle = PRIMARY;
      ctx.lineWidth = isLatest ? 2 : 1;
      roundRect(ctx, block.x, block.y, BLOCK_W, BLOCK_H, BLOCK_R);
      ctx.fill();
      ctx.stroke();

      // Hash label for latest confirmed block
      if (isLatest) {
        ctx.fillStyle = PRIMARY;
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatHash(block.hash), block.x + BLOCK_W / 2, block.y - 4);
      }
    });

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  function drawConnecting(ctx, w, h) {
    // Shimmer effect
    var t = Date.now() / 1000;
    var shimmerX = (t % 3) / 3 * w;

    ctx.fillStyle = 'rgba(79,152,163,0.05)';
    ctx.fillRect(shimmerX - 60, 0, 120, h);

    ctx.fillStyle = 'rgba(226,232,240,0.4)';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Connecting to Kaspa network...', w / 2, h / 2);

    // Pulsing dots
    for (var i = 0; i < 3; i++) {
      var dotPhase = Math.sin(t * 3 + i * 0.8);
      var alpha = 0.3 + 0.4 * Math.max(0, dotPhase);
      ctx.fillStyle = 'rgba(79,152,163,' + alpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(w / 2 - 12 + i * 12, h / 2 + 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ── Tooltip ─────────────────────────────────────────────── */

  function showTooltip(block, mouseX, mouseY, canvas) {
    hideTooltip();
    _tooltipBlock = block;
    var tip = document.createElement('div');
    tip.id = 'dagTooltip';
    tip.style.cssText = 'position:fixed;background:#1d2840;border:1px solid rgba(79,152,163,0.4);color:#e2e8f0;padding:10px 14px;border-radius:8px;z-index:1000;font-family:JetBrains Mono,monospace;font-size:11px;pointer-events:none;line-height:1.6;max-width:320px;';
    var ts = block.timestamp ? new Date(block.timestamp * 1000).toLocaleString() : 'N/A';
    tip.innerHTML = '<div style="color:' + PRIMARY + ';font-weight:600;margin-bottom:4px;">Block</div>' +
      '<div>Hash: ' + formatHash(block.hash) + '</div>' +
      '<div>Time: ' + ts + '</div>' +
      '<div>Parents: ' + block.parents.length + '</div>' +
      '<div>Blue Score: ' + formatNumber(block.blueScore) + '</div>';

    var rect = canvas.getBoundingClientRect();
    tip.style.left = (rect.left + mouseX + 16) + 'px';
    tip.style.top = (rect.top + mouseY - 20) + 'px';
    document.body.appendChild(tip);
    _tooltip = tip;
  }

  function hideTooltip() {
    if (_tooltip) {
      _tooltip.remove();
      _tooltip = null;
      _tooltipBlock = null;
    }
  }

  function handleCanvasClick(e, canvas) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var mx = (e.clientX - rect.left) * scaleX;
    var my = (e.clientY - rect.top) * scaleY;

    var clicked = null;
    _blocks.forEach(function(b) {
      if (mx >= b.x && mx <= b.x + BLOCK_W && my >= b.y && my <= b.y + BLOCK_H) {
        clicked = b;
      }
    });

    if (clicked) {
      if (_tooltipBlock && _tooltipBlock.hash === clicked.hash) {
        hideTooltip();
      } else {
        showTooltip(clicked, e.clientX - rect.left, e.clientY - rect.top, canvas);
      }
    } else {
      hideTooltip();
    }
  }

  /* ── Resize ──────────────────────────────────────────────── */

  function resizeCanvas(canvas) {
    var container = canvas.parentElement;
    if (!container) return;
    var w = container.clientWidth;
    var h = parseInt(canvas.getAttribute('height'), 10) || container.clientHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
  }

  /* ── Animation Loop ──────────────────────────────────────── */

  function animate() {
    _canvases.forEach(function(c) { drawDAG(c); });
    _animId = requestAnimationFrame(animate);
  }

  /* ── Init ────────────────────────────────────────────────── */

  function init() {
    var main = document.getElementById('dagCanvasFull');
    var mini = document.getElementById('dagCanvasMini');

    if (main) {
      _canvases.push(main);
      resizeCanvas(main);
      main.addEventListener('click', function(e) { handleCanvasClick(e, main); });
    }
    if (mini) {
      _canvases.push(mini);
      resizeCanvas(mini);
      mini.addEventListener('click', function(e) { handleCanvasClick(e, mini); });
    }

    if (_canvases.length === 0) {
      console.warn('[BlockDAG] No canvas elements found');
      return;
    }

    window.addEventListener('resize', function() {
      _canvases.forEach(resizeCanvas);
      hideTooltip();
    });

    // Hide tooltip on scroll
    document.addEventListener('scroll', hideTooltip, true);

    // Start animation
    _animId = requestAnimationFrame(animate);

    // Fetch immediately then poll
    fetchBlocks();
    fetchStats();
    _blockTimer = setInterval(fetchBlocks, BLOCK_POLL_MS);
    _statsTimer = setInterval(fetchStats, STATS_POLL_MS);

    console.log('[BlockDAG] Initialized with ' + _canvases.length + ' canvas(es)');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
