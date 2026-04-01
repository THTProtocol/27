/**
 * htp-blockdag-viz.js - Live Kaspa BlockDAG Visualization (Canvas-based)
 *
 * FEATURES:
 *  1. Real-time block DAG fetching from Kaspa RPC/REST API every 3 seconds
 *  2. Canvas-based animated visualization with teal accent colors
 *  3. Latest block highlighted with pulsing glow4. Smooth fade-in for new blocks
 *  5. Compact mini-widget (120px height) for header/overview
 *  6. Full-size detailed view in the Kaspa section
 */

(function(window) {
  'use strict';

  var BLOCK_UPDATE_INTERVAL_MS = 3000;  // Update every 3 seconds
  var MAX_BLOCKS_IN_VIEW = 50;
  var BLOCK_WIDTH = 60;
  var BLOCK_HEIGHT = 24;
  var BLOCK_RADIUS = 4;

  var _blocks = [];          // Array of {hash, parents: [], height, timestamp}
  var _latestBlockHash = null;
  var _isConnected = false;
  var _animationFrameId = null;

  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. BLOCK FETCHING
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function fetchBlocksFromRpc() {
    try {
      var apiUrl = (window.HTP_RPC_URL || '').replace('wss://', 'https://').replace('ws://', 'http://')
                     .replace('/rpc', '/api');

      if (!apiUrl || apiUrl === '//api') {
        // Fallback to default TN12 API
        apiUrl = 'https://api-tn12.kaspa.org';
      }

      // Set a reasonable timeout
      var controller = new AbortController();
      var timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        var resp = await fetch(apiUrl + '/blocks?includeBlocks=true&lowHash=&desiredBlockCount=100', {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          console.warn('[BlockDAG] API error:', resp.status);
          return false;
        }

        var data = await resp.json();
        if (data && data.blocks && Array.isArray(data.blocks)) {
          updateBlocksFromData(data.blocks);
          _isConnected = true;
          return true;
        }
      } catch(e) {
        clearTimeout(timeoutId);
        if (e.name !== 'AbortError') {
          console.warn('[BlockDAG] Fetch error:', e.message);
        }
      }
    } catch(e) {
      console.warn('[BlockDAG] RPC fetch error:', e);
    }
    return false;
  }

  function updateBlocksFromData(blocks) {
    var newBlocks = blocks.slice(0, MAX_BLOCKS_IN_VIEW).map(function(b) {
      return {
        hash: b.header ? b.header.hash : b.hash,
        parents: b.header && b.header.parents ? b.header.parents : (b.parentHashes || []),
        height: b.header ? b.header.blockLevel : (b.level || 0),
        timestamp: b.header ? b.header.timestamp : (b.timestamp || 0),
        opacity: 1  // For animation
      };
    });

    // Check if latest block changed
    if (newBlocks.length > 0 && newBlocks[0].hash !== _latestBlockHash) {
      _latestBlockHash = newBlocks[0].hash;
      // Mark new blocks for fade-in animation
      newBlocks.forEach(function(b) {
        var existing = _blocks.find(x => x.hash === b.hash);
        if (!existing) {
          b.opacity = 0;  // Fade in
        }
      });
    }

    _blocks = newBlocks;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. CANVAS RENDERING
   * ═══════════════════════════════════════════════════════════════════════════ */

  function drawBlockDAG(ctx, width, height, isMini) {
    // Clear
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    if (_blocks.length === 0) {
      // Show "connecting" message
      ctx.fillStyle = 'rgba(226,232,240,0.4)';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Connecting to Kaspa...', width / 2, height / 2 - 10);

      // Pulsing dot
      var scale = 0.5 + 0.5 * Math.sin(Date.now() / 300);
      ctx.fillStyle = 'rgba(79,152,163,' + (0.5 + scale * 0.5).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 + 10, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    var blockY = isMini ? height - BLOCK_HEIGHT - 8 : height / 2 - BLOCK_HEIGHT / 2;
    var startX = isMini ? 8 : 20;
    var spacing = isMini ? 50 : BLOCK_WIDTH + 10;

    // Draw blocks left to right (oldest to newest)
    _blocks.forEach(function(block, idx) {
      var x = startX + idx * spacing;

      if (x + BLOCK_WIDTH > width - 20) return;  // Don't draw off-screen

      var isLatest = block.hash === _latestBlockHash;

      // Fade in animation
      if (block.opacity < 1) {
        block.opacity = Math.min(1, block.opacity + 0.1);
      }

      // Draw glow for latest block
      if (isLatest) {
        var glowSize = 8 + 4 * Math.sin(Date.now() / 200);
        ctx.fillStyle = 'rgba(79,152,163,' + (0.2 - glowSize * 0.02).toFixed(2) + ')';
        ctx.beginPath();
        ctx.roundRect(x - glowSize, blockY - glowSize, BLOCK_WIDTH + glowSize * 2, BLOCK_HEIGHT + glowSize * 2, BLOCK_RADIUS);
        ctx.fill();
      }

      // Draw block
      ctx.fillStyle = 'rgba(17,24,39,' + block.opacity + ')';
      ctx.strokeStyle = isLatest ? 'rgba(79,152,163,1)' : 'rgba(79,152,163,0.4)';
      ctx.lineWidth = isLatest ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, blockY, BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_RADIUS);
      ctx.fill();
      ctx.stroke();

      // Draw block label (first 3 + last 3 hex chars)
      ctx.fillStyle = isLatest ? 'rgba(79,152,163,1)' : 'rgba(226,232,240,0.6)';
      ctx.font = '9px JetBrains Mono';
      ctx.textAlign = 'center';
      var label = block.hash.substring(0, 3) + '…' + block.hash.slice(-3);
      ctx.fillText(label, x + BLOCK_WIDTH / 2, blockY + BLOCK_HEIGHT / 2 + 3);
    });

    // Draw time stamp
    if (_blocks.length > 0 && !isMini) {
      ctx.fillStyle = 'rgba(226,232,240,0.3)';
      ctx.font = '11px Inter';
      ctx.textAlign = 'left';
      var recent = _blocks[0];
      var time = new Date(recent.timestamp).toLocaleTimeString();
      ctx.fillText('Latest: ' + time, 20, height - 12);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. ANIMATION LOOP
   * ═══════════════════════════════════════════════════════════════════════════ */

  function startAnimationLoop(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    function animate() {
      var width = canvas.width;
      var height = canvas.height;
      drawBlockDAG(ctx, width, height, height <= 120);
      _animationFrameId = requestAnimationFrame(animate);
    }

    animate();
  }

  function stopAnimationLoop() {
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. PUBLIC API
   * ═══════════════════════════════════════════════════════════════════════════ */

  window.htpBlockDAG = {
    async init(containerSelector, isMini) {
      var container = document.querySelector(containerSelector);
      if (!container) {
        console.warn('[BlockDAG] Container not found:', containerSelector);
        return;
      }

      // Create canvas
      var canvas = document.createElement('canvas');
      var size = isMini ? { width: 600, height: 120 } : { width: 800, height: 250 };
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.style.cssText = 'border:1px solid rgba(79,152,163,0.15);border-radius:8px;background:#0a0e1a;display:block;width:100%';
      container.appendChild(canvas);

      // Start animation loop
      startAnimationLoop(canvas);

      // Start data fetching
      this.startPolling();

      console.log('[BlockDAG] Initialized on', containerSelector);
    },

    startPolling() {
      // Fetch immediately
      fetchBlocksFromRpc();

      // Then poll every N seconds
      this.pollInterval = setInterval(async () => {
        await fetchBlocksFromRpc();
      }, BLOCK_UPDATE_INTERVAL_MS);
    },

    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      stopAnimationLoop();
    },

    getLatestBlockHash() {
      return _latestBlockHash;
    },

    getBlockCount() {
      return _blocks.length;
    },

    isConnected() {
      return _isConnected;
    }
  };

  // Polyfill roundRect for older browsers
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
    };
  }

  console.log('[BlockDAG] Module loaded');

})(window);
