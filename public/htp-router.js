/* ══════════════════════════════════════════════
   HTP ROUTER v1.0 — 14-screen hash SPA
   No React. No build. Vanilla JS.
   ══════════════════════════════════════════════ */
(function(){
  "use strict";

  var API   = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.duckdns.org";
  var root  = null;
  var cache = {};
  var timers = {};

  function $(sel) { return document.querySelector(sel); }

  // ▸ FETCH helpers
  async function api(path) {
    try {
      var r = await fetch(API + path, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch(e) { return null; }
  }

  function kasFromSompi(sompi) {
    return sompi ? (Number(BigInt(sompi)) / 1e8).toFixed(2) : "0.00";
  }

  function shortAddr(a) { return a ? a.slice(0,8)+"..."+a.slice(-6) : "???"; }

  // ▸ PAGE WRAPPER
  function page(title, subtitle, html) {
    return "<div class=\"htp-page\">" +
      "<h1 class=\"htp-page-title\">" + title + "</h1>" +
      (subtitle ? "<p class=\"htp-page-subtitle\">" + subtitle + "</p>" : "") +
      html + "</div>";
  }

  function empty(msg) {
    return "<div class=\"htp-empty\"><div class=\"htp-empty-icon\">◈</div>" + msg + "</div>";
  }

  function badge(status) {
    var map = { open: "open", active: "active", pending: "active", settled: "settled", disputed: "disputed" };
    return "<span class=\"htp-badge htp-badge-" + (map[status]||"settled") + "\">" + (status||"???").toUpperCase() + "</span>";
  }

  // ════════════════════════════════════════════
  // 1. #/lobby
  // ════════════════════════════════════════════
  async function screenLobby() {
    var games = await api("/api/games");
    if (!games || !Array.isArray(games) || games.length === 0) {
      games = [
// [demo ref removed]
// [demo ref removed]
// [demo ref removed]
      ];
    }
    var typeIcons = { SkillGame: "♟", TournamentBracket: "◈", ParimutuelMarket: "⬡" };
    var cards = games.map(function(g) {
      var fee = kasFromSompi(g.entry_fee_sompi || g.entry_fee || 0);
      return "<div class=\"htp-card\" style=\"cursor:pointer\" onclick=\"window.htpRouter.navigate('#/game/" + g.id + "')\">" +
        "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:10px\">" +
        "<strong>" + (typeIcons[g.game_type]||"◆") + " " + (g.game_type||"Match") + "</strong>" +
        badge(g.status) + "</div>" +
        "<div style=\"font-size:11px;color:var(--htp-muted);margin-bottom:10px\">" +
        "Entry: <span style=\"color:var(--htp-gold);font-weight:700\">" + fee + " KAS</span>" +
        " | Players: " + (g.players||"0") + "/" + (g.max_players||"∞") +
        " | Creator: " + shortAddr(g.creator) + "</div>" +
        "<button class=\"htp-btn\" onclick=\"event.stopPropagation();window.htpRouter.navigate('#/game/" + g.id + "')\">Join</button>" +
        "</div>";
    }).join("");
    root.innerHTML = page("LOBBY", "Open matches on Kaspa Testnet — no house, no custody",
      "<div class=\"htp-grid\">" + cards + "</div>");
    // Poll every 10s
    clearInterval(timers.lobby);
    timers.lobby = setInterval(screenLobby, 10000);
  }

  // ════════════════════════════════════════════
  // 2. #/create
  // ════════════════════════════════════════════
  function screenCreate() {
    root.innerHTML = page("CREATE MATCH", "Propose a new covenant game",
      "<div class=\"htp-card\" style=\"max-width:500px\">" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Game Type</label>" +
      "<select id=\"create-type\" class=\"htp-select\">" +
      "<option value=\"SkillGame\">Skill Match</option>" +
      "<option value=\"TournamentBracket\">Tournament Bracket</option>" +
      "<option value=\"ParimutuelMarket\">Prediction Market</option></select></div>" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Entry Fee (KAS)</label>" +
      "<input id=\"create-fee\" class=\"htp-input\" type=\"number\" min=\"1\" step=\"0.1\" value=\"1\"></div>" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Max Players</label>" +
      "<input id=\"create-max\" class=\"htp-input\" type=\"number\" min=\"2\" max=\"16\" value=\"2\"></div>" +
      "<button class=\"htp-btn\" onclick=\"window.htpRouter._createGame()\">CREATE MATCH</button>" +
      "</div>");
  }

  window.htpRouter = window.htpRouter || {};
  window.htpRouter._createGame = async function() {
    var type = document.getElementById("create-type").value;
    var fee  = document.getElementById("create-fee").value;
    var max  = document.getElementById("create-max").value;
    var creator = window.connectedAddress || window.htpAddress || prompt("Your Kaspa address:");
    if (!creator) return;
    var body = { game_type: type, entry_fee_sompi: String(BigInt(Math.round(parseFloat(fee)*1e8))), max_players: parseInt(max), creator: creator };
    try {
      var r = await fetch(API + "/api/games", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      var j = await r.json();
      if (j && j.id) {
        window.htpRouter.navigate("#/game/" + j.id);
      } else {
        var toast = document.createElement("div"); toast.className="htp-toast";
        toast.textContent = "Error: " + (j.error || "Failed"); document.body.appendChild(toast);
        setTimeout(function(){ toast.remove(); }, 3000);
      }
    } catch(e) {
// [stub removed]
    }
  };

  // ════════════════════════════════════════════
  // 3. #/game/:id
  // ════════════════════════════════════════════
  async function screenGame(id) {
    var g = await api("/api/games/" + id);
    if (!g) { root.innerHTML = page("GAME", "", empty("Game not found: " + id)); return; }
    var fee = kasFromSompi(g.entry_fee_sompi || g.entry_fee || 0);
    var myAddr = window.connectedAddress || window.htpAddress;
    var canJoin = g.status === "open" && myAddr && g.creator !== myAddr;
    root.innerHTML = page("GAME #" + id.slice(-8), "Status: " + badge(g.status),
      "<div class=\"htp-card\">" +
      "<table class=\"htp-table\"><tr><th>Type</th><td>" + (g.game_type||g.type||"Match") + "</td></tr>" +
      "<tr><th>Entry Fee</th><td style=\"color:var(--htp-gold);font-weight:700\">" + fee + " KAS</td></tr>" +
      "<tr><th>Players</th><td>" + (g.players||"0") + "/" + (g.max_players||"∞") + "</td></tr>" +
      "<tr><th>Creator</th><td style=\"font-family:var(--htp-font);font-size:11px\">" + (g.creator||"?") + "</td></tr>" +
      "<tr><th>Status</th><td>" + badge(g.status) + "</td></tr>" +
      "</table>" +
      (canJoin ? "<button class=\"htp-btn\" style=\"margin-top:16px\" onclick=\"window.htpRouter._joinGame('"+id+"')\">JOIN MATCH</button>" : "") +
      "</div>");
    // Auto-refresh
    clearInterval(timers["game_"+id]);
    timers["game_"+id] = setInterval(function(){ screenGame(id); }, 5000);
  }

  window.htpRouter._joinGame = async function(id) {
    var addr = window.connectedAddress || window.htpAddress;
    if (!addr) { var t=document.createElement("div");t.className="htp-toast";t.textContent="Connect wallet first";document.body.appendChild(t);setTimeout(function(){t.remove()},3000); return; }
    var r = await fetch(API + "/api/games/" + id + "/join", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({player: addr}) });
    if (r.ok) { window.htpRouter.navigate("#/game/" + id); }
    else { var t=document.createElement("div");t.className="htp-toast";t.textContent="Join failed";document.body.appendChild(t);setTimeout(function(){t.remove()},3000); }
  };

  // ════════════════════════════════════════════
  // 4. #/settle/:id
  // ════════════════════════════════════════════
  async function screenSettle(id) {
    var g = await api("/api/games/" + id);
    if (!g) { root.innerHTML = page("SETTLE", "", empty("Game not found")); return; }
    root.innerHTML = page("SETTLE #" + id.slice(-8), "Propose outcome via arbiter attestation",
      "<div class=\"htp-card\" style=\"max-width:500px\">" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Winner Address</label>" +
      "<input id=\"settle-winner\" class=\"htp-input\" placeholder=\"kaspatest:...\"></div>" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Settlement Path</label>" +
      "<select id=\"settle-path\" class=\"htp-select\"><option value=\"A\">PATH A — Arbiter</option><option value=\"B\">PATH B — Dispute Window</option><option value=\"C\">PATH C — Guardian</option></select></div>" +
      "<button class=\"htp-btn\" onclick=\"window.htpRouter._proposeSettle('"+id+"')\">PROPOSE SETTLEMENT</button>" +
      "</div>");
  }

  window.htpRouter._proposeSettle = async function(id) {
    var w = document.getElementById("settle-winner").value;
    var p = document.getElementById("settle-path").value;
    if (!w) { var t=document.createElement("div");t.className="htp-toast";t.textContent="Enter winner address";document.body.appendChild(t);setTimeout(function(){t.remove()},3000); return; }
    var r = await fetch(API + "/api/games/" + id + "/propose", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({winner: w, proof_root: "0".repeat(64), settlement_path: p})
    });
    var j = await r.json();
    var toast = document.createElement("div"); toast.className="htp-toast";
    toast.textContent = "Attestation: " + (j.attestation_hash ? j.attestation_hash.slice(0,16)+"..." : "FAILED");
    document.body.appendChild(toast); setTimeout(function(){ toast.remove(); }, 4000);
  };

  // ════════════════════════════════════════════
  // 5. #/dispute/:id
  // ════════════════════════════════════════════
  function screenDispute(id) {
    root.innerHTML = page("DISPUTE #" + id.slice(-8), "Challenge outcome or invoke guardian",
      "<div class=\"htp-card\">" +
      "<button class=\"htp-btn htp-btn-ghost\" onclick=\"window.htpRouter._challenge('"+id+"')\">CHALLENGE OUTCOME</button>" +
      "<button class=\"htp-btn htp-btn-ghost\" style=\"margin-left:8px\" onclick=\"window.htpRouter._guardianOverride('"+id+"')\">GUARDIAN OVERRIDE</button>" +
      "</div>");
  }

  window.htpRouter._challenge = async function(id) {
    var r = await fetch(API + "/api/games/" + id + "/challenge", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({challenger: window.connectedAddress||"unknown"}) });
    var j = await r.json();
// [stub removed]
  };

  window.htpRouter._guardianOverride = async function(id) {
    var r = await fetch(API + "/api/games/" + id + "/guardian", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action: "override", guardian: window.connectedAddress}) });
    var txt=await r.text();var t=document.createElement("div");t.className="htp-toast";t.textContent="Guardian: "+txt;document.body.appendChild(t);setTimeout(function(){t.remove()},4000);
  };

  // ════════════════════════════════════════════
  // 6. #/wallet
  // ════════════════════════════════════════════
  async function screenWallet() {
    var addr = window.connectedAddress || window.htpAddress || null;
    var bal = "0.00";
    if (addr) {
      var b = await api("/api/balance/" + addr);
      bal = b ? kasFromSompi(b.balance_sompi || 0) : "0.00";
    }
    root.innerHTML = page("WALLET", "Manage your Kaspa identity",
      "<div class=\"htp-card\" style=\"max-width:500px\">" +
      (addr ? "<div style=\"margin-bottom:16px\"><label class=\"htp-label\">Address</label><div class=\"htp-code\" style=\"word-break:break-all\">" + addr + "</div></div>" : "") +
      "<div style=\"margin-bottom:16px\"><label class=\"htp-label\">Balance</label><strong style=\"font-size:24px;color:var(--htp-gold)\">" + bal + " KAS</strong></div>" +
      "<button class=\"htp-btn\" onclick=\"try{window.htpWalletV3.importMnemonic()}catch(e){{var t=document.createElement(div);t.className=htp-toast;t.textContent=e.message;document.body.appendChild(t);setTimeout(function(){t.remove()},4000)}}\">IMPORT MNEMONIC</button>" +
      "<button class=\"htp-btn htp-btn-ghost\" style=\"margin-left:8px\" onclick=\"try{window.htpWalletV3.generateWallet()}catch(e){{var t=document.createElement(div);t.className=htp-toast;t.textContent=e.message;document.body.appendChild(t);setTimeout(function(){t.remove()},4000)}}\">GENERATE WALLET</button>" +
      (addr ? "<button class=\"htp-btn htp-btn-ghost\" style=\"margin-left:8px\" onclick=\"window.htpWalletV3.disconnect()\">DISCONNECT</button>" : "") +
      "</div>");
  }

  // ════════════════════════════════════════════
  // 7. #/markets
  // ════════════════════════════════════════════
  async function screenMarkets() {
    var games = await api("/api/games?type=parimutuel");
    if (!games || !Array.isArray(games) || games.length === 0) {
// [demo ref removed]
    }
    var cards = games.map(function(m) {
      return "<div class=\"htp-card\" onclick=\"window.htpRouter.navigate('#/market/" + m.id + "')\" style=\"cursor:pointer\">" +
        "<strong>⬡ " + (m.title||"Prediction Market") + "</strong> " + badge(m.status) +
        "<div style=\"font-size:11px;color:var(--htp-muted);margin-top:6px\">Pool: " + kasFromSompi(m.pool||m.entry_fee_sompi||0) + " KAS</div>" +
        "<button class=\"htp-btn htp-btn-ghost htp-btn-sm\" style=\"margin-top:10px\" onclick=\"event.stopPropagation();window.htpRouter.navigate('#/market/" + m.id + "')\">VIEW</button>" +
        "</div>";
    }).join("");
    root.innerHTML = page("MARKETS", "Prediction markets on Kaspa Testnet",
      "<div class=\"htp-grid\">" + cards + "</div>");
  }

  // ════════════════════════════════════════════
  // 8. #/market/:id
  // ════════════════════════════════════════════
  async function screenMarket(id) {
    var m = await api("/api/games/" + id);
    if (!m) { root.innerHTML = page("MARKET", "", empty("Market not found")); return; }
    root.innerHTML = page("MARKET", (m.title||"Prediction Market") + " — Pool: " + kasFromSompi(m.pool||0) + " KAS",
      "<div class=\"htp-card\">" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Your Stake</label>" +
      "<select id=\"market-outcome\" class=\"htp-select\">" + ((m.outcomes||["Yes","No"]).map(function(o){return "<option>"+o+"</option>";}).join("")) + "</select></div>" +
      "<div class=\"htp-field\"><label class=\"htp-label\">Amount (KAS)</label>" +
      "<input id=\"market-amount\" class=\"htp-input\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"0.5\"></div>" +
      "<button class=\"htp-btn\" onclick=\"window.htpRouter._placeStake('"+id+"')\">CONFIRM STAKE</button>" +
      "</div>");
  }

  // ════════════════════════════════════════════
  // 9. #/tournament
  // ════════════════════════════════════════════
  async function screenTournament() {
    var games = await api("/api/games?type=tournament");
    if (!games || !Array.isArray(games) || games.length === 0) {
// [demo ref removed]
    }
    var cards = games.map(function(t) {
      return "<div class=\"htp-card\" onclick=\"window.htpRouter.navigate('#/tournament/" + t.id + "')\" style=\"cursor:pointer\">" +
        "<strong>◈ Tournament</strong> " + badge(t.status) +
        "<div style=\"font-size:11px;color:var(--htp-muted);margin-top:6px\">Players: " + (t.players||0) + "/" + (t.max_players||8) + " | Rounds: " + (t.rounds||"?") + " | Prize: " + kasFromSompi(t.entry_fee_sompi||0) + " KAS</div>" +
        "</div>";
    }).join("");
    root.innerHTML = page("TOURNAMENTS", "Bracket competitions",
      "<div class=\"htp-grid\">" + cards + "</div>");
  }

  // ════════════════════════════════════════════
  // 10. #/tournament/:id
  // ════════════════════════════════════════════
  async function screenTournamentId(id) {
    var t = await api("/api/games/" + id);
    if (!t) { root.innerHTML = page("TOURNAMENT", "", empty("Tournament not found")); return; }
    
    var fee = (t.stake_sompi || 0) / 1e8;
    var prize = fee * (t.max_players || 8);
    var players = [];
    try { 
      if (t.player_list) players = JSON.parse(t.player_list); 
      else if (t.players) players = Array.isArray(t.players) ? t.players : [];
    } catch(e) {}
    
    // Build dynamic bracket
    var slots = t.max_players || 8;
    var html = '<div class="htp-card" style="margin-bottom:16px">';
    html += '<table class="htp-table"><tr><th>Type</th><td>Tournament Bracket</td></tr>';
    html += '<tr><th>Entry Fee</th><td style="color:var(--htp-gold)">' + fee.toFixed(2) + ' KAS</td></tr>';
    html += '<tr><th>Prize Pool</th><td style="color:var(--htp-gold);font-weight:700">' + prize.toFixed(2) + ' KAS</td></tr>';
    html += '<tr><th>Players</th><td>' + players.length + '/' + slots + '</td></tr>';
    html += '<tr><th>Status</th><td>' + badge(t.status) + '</td></tr></table></div>';
    
    html += '<div class="htp-card"><h3 style="color:var(--htp-gold);margin-top:0">Bracket</h3>';
    html += '<table class="htp-table"><thead><tr><th>Slot</th><th>Player</th><th>Status</th></tr></thead><tbody>';
    for (var i = 0; i < Math.min(slots, 16); i++) {
      var p = players[i] || null;
      html += '<tr><td style="font-family:var(--htp-font)">#' + (i+1) + '</td>';
      html += '<td>' + (p ? '<span style="color:var(--htp-gold)">' + shortAddr(p) + '</span>' : '<span style="color:var(--htp-muted)">Waiting...</span>') + '</td>';
      html += '<td>' + (p ? '<span class="htp-badge htp-badge-active">SEEDED</span>' : '<span class="htp-badge htp-badge-settled">OPEN</span>') + '</td></tr>';
    }
    html += '</tbody></table>';
    
    if (t.status === "settled") {
      html += '<div style="margin-top:16px;padding:12px;background:rgba(201,168,76,0.1);border:1px solid var(--htp-gold);border-radius:var(--htp-radius)">';
      html += '<strong style="color:var(--htp-gold)">WINNER:</strong> ' + (t.winner ? shortAddr(t.winner) : "Unknown") + '</div>';
    }
    
    html += '</div>';
    root.innerHTML = page("TOURNAMENT", "Bracket #" + id.slice(-8), html);
  }

  async function screenAdmin() {
    var pass = sessionStorage.getItem("htpAdminKey");
    if (!pass || pass.length < 8) {
      root.innerHTML = page("ADMIN", "", "<div class=\"htp-card\"><input id=\"admin-pass\" class=\"htp-input\" type=\"password\" placeholder=\"Admin key\"><button class=\"htp-btn\" style=\"margin-top:10px\" onclick=\"sessionStorage.setItem('htpAdminKey',document.getElementById('admin-pass').value);window.htpRouter.navigate('#/admin')\">UNLOCK</button></div>");
      return;
    }
    var health = await api("/health");
    var stats  = await api("/api/admin/stats");
    var cov    = await api("/api/covenants/deployed");
    root.innerHTML = page("ADMIN", "Protocol controls",
      "<div class=\"htp-card\"><strong>Health:</strong> " + JSON.stringify(health) + "</div>" +
      "<div class=\"htp-card\"><strong>Stats:</strong> " + JSON.stringify(stats) + "</div>" +
      "<div class=\"htp-card\"><strong>Covenants:</strong> " + JSON.stringify(cov) + "</div>" +
      "<div class=\"htp-card\"><strong>Force Settle:</strong><input id=\"force-id\" class=\"htp-input\" placeholder=\"Game ID\"><button class=\"htp-btn\" style=\"margin-top:8px\" onclick=\"alert('Not implemented')\">TRIGGER</button></div>");
  }

  // ════════════════════════════════════════════
  // 12. #/docs
  // ════════════════════════════════════════════
  function screenDocs() {
    root.innerHTML = page("DOCS", "Protocol specification",
      "<div class=\"htp-card\"><h3 style=\"color:var(--htp-gold)\">High Table Protocol</h3>" +
      "<p>Trustless skill-game covenants on Kaspa. Zero counterparty risk.</p>" +
      "<h4 style=\"color:var(--htp-gold);margin-top:20px\">Settlement Flow</h4>" +
      "<ol>" +
      "<li>Player locks KAS into covenant UTXO</li>" +
      "<li>Match completes → arbiter proposes outcome</li>" +
      "<li>Dispute window (N blocks) → challenge or finalize</li>" +
      "<li>Guardian window → override if dispute unresolved</li>" +
      "<li>Winner claims funds</li></ol>" +
      "<h4 style=\"color:var(--htp-gold);margin-top:20px\">Contracts</h4>" +
      "<table class=\"htp-table\">" +
      "<tr><th>Contract</th><th>Lines</th><th>Entrypoints</th></tr>" +
      "<tr><td>SkillGame.ss</td><td>285</td><td>8</td></tr>" +
      "<tr><td>TournamentBracket.ss</td><td>181</td><td>6</td></tr>" +
      "<tr><td>ParimutuelMarket.ss</td><td>221</td><td>6</td></tr>" +
      "<tr><td>MaximizerEscrow.ss</td><td>169</td><td>6</td></tr>" +
      "</table></div>");
  }

  // ════════════════════════════════════════════
  // 13. #/tx/:txid
  // ════════════════════════════════════════════
  function screenTx(txid) {
    root.innerHTML = page("TRANSACTION", "TX details",
      "<div class=\"htp-card\"><div class=\"htp-code\" style=\"word-break:break-all\">" + txid + "</div>" +
      "<a href=\"https://explorer-tn12.kaspa.org/txs/" + txid + "\" target=\"_blank\" style=\"color:var(--htp-gold);font-size:12px\">View on TN12 Explorer ↗</a></div>");
  }

  // ════════════════════════════════════════════
  // 14. #/status
  // ════════════════════════════════════════════
  async function screenStatus() {
    var health   = await api("/health");
    var config   = await api("/api/config");
    var games    = await api("/api/games");
    var cov      = await api("/api/covenants/deployed");
    var gameCount = (games && Array.isArray(games)) ? games.length : 0;
    root.innerHTML = page("STATUS", "Live protocol dashboard",
      "<div class=\"htp-grid\">" +
      "<div class=\"htp-card\"><strong>Server</strong><br>" + (health ? health.status : "OFFLINE") + " v" + (health&&health.version||"?") + "</div>" +
      "<div class=\"htp-card\"><strong>Network</strong><br>Kaspa Testnet (TN12)</div>" +
      "<div class=\"htp-card\"><strong>Active Games</strong><br>" + gameCount + "</div>" +
      "<div class=\"htp-card\"><strong>Arbiter</strong><br>" + (config&&config.arbiter ? shortAddr(config.arbiter) : "?") + "</div>" +
      "<div class=\"htp-card\"><strong>Covenants</strong><br>" + (cov ? Object.keys(cov).length : 0) + " deployed</div>" +
      "<div class=\"htp-card\"><strong>Chain</strong><br><span class=\"htp-badge htp-badge-open htp-badge-live\">LIVE</span></div>" +
      "</div>");
    clearInterval(timers.status);
    timers.status = setInterval(screenStatus, 5000);
  }

  // ════════════════════════════════════════════
  
  // ▸ Market stake submission (wallet flow)
  window.htpRouter._placeStake = async function(id) {
    var addr = window.connectedAddress || window.htpAddress;
    if (!addr) {
      try { if (window.htpWalletV3 && window.htpWalletV3.showConnectModal) window.htpWalletV3.showConnectModal(); } catch(e) {}
      var toast = document.createElement("div"); toast.className = "htp-toast";
      toast.textContent = "Connect wallet first"; document.body.appendChild(toast);
      setTimeout(function(){ toast.remove(); }, 3000); return;
    }
    var outcomeEl = document.getElementById("market-outcome");
    var amountEl  = document.getElementById("market-amount");
    if (!outcomeEl || !amountEl) {
      var toast = document.createElement("div"); toast.className = "htp-toast";
      toast.textContent = "Form elements missing"; document.body.appendChild(toast);
      setTimeout(function(){ toast.remove(); }, 3000); return;
    }
    var outcome = outcomeEl.value;
    var amount  = parseFloat(amountEl.value || "0.5");
    if (isNaN(amount) || amount <= 0) {
      var toast = document.createElement("div"); toast.className = "htp-toast";
      toast.textContent = "Invalid amount"; document.body.appendChild(toast);
      setTimeout(function(){ toast.remove(); }, 3000); return;
    }
    var sompi = String(Math.round(amount * 1e8));
    // Use htpApi for the call
    var base = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.duckdns.org";
    try {
      var r = await fetch(base + "/api/games/" + id + "/join", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({player: addr, outcome: outcome, stake_sompi: sompi})
      });
      var j = await r.json();
      if (j && j.message) {
        var toast = document.createElement("div"); toast.className = "htp-toast";
        toast.textContent = "Stake recorded — " + j.message;
        document.body.appendChild(toast);
        setTimeout(function(){ toast.remove(); }, 3000);
      }
    } catch(e) {
      var toast = document.createElement("div"); toast.className = "htp-toast";
      toast.textContent = "Failed: " + e.message;
      document.body.appendChild(toast);
      setTimeout(function(){ toast.remove(); }, 3000);
    }
  };

  // ROUTER ENGINE
  // ════════════════════════════════════════════
  function render() {
    root = root || document.getElementById("htp-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "htp-root";
      var shell = document.querySelector(".shell") || document.body;
      shell.insertBefore(root, shell.firstChild);
    }
    var hash = window.location.hash.replace("#", "") || "lobby";
  if (!hash || hash === "/" || hash === "#" || hash === "") hash = "#/lobby";
  hash = (!hash || hash === "/" || hash === "#") ? "/lobby" : hash.replace(/^#/, "");
    var parts = hash.split("/");
    var route = "/" + parts[0];
    var id    = parts[1] || null;

    // Find and highlight active nav link
    document.querySelectorAll(".nav-btn[data-v]").forEach(function(b) { var mapping = { overview: "lobby", markets: "markets", create: "create", wallet: "wallet", oracle: "status", portfolio: "wallet" }; var expected = mapping[b.getAttribute("data-v")] || b.getAttribute("data-v"); b.classList.toggle("act", parts[0] === expected);
    });

    switch(route) {
      case "/overview":
    case "/lobby":       screenLobby(); break;
      case "/create":      screenCreate(); break;
      case "/game":        screenGame(id); break;
      case "/settle":      screenSettle(id); break;
      case "/dispute":     screenDispute(id); break;
      case "/wallet":      screenWallet(); break;
      case "/markets":     screenMarkets(); break;
      case "/market":      screenMarket(id); break;
      case "/tournament":  id ? screenTournamentId(id) : screenTournament(); break;
      case "/admin":       screenAdmin(); break;
      case "/docs":        screenDocs(); break;
      case "/tx":          screenTx(id); break;
      case "/status":      screenStatus(); break;
      default:             window.htpRouter.navigate("#/lobby"); break;
    }
  }

  window.htpRouter.navigate = function(hash) {
    window.location.hash = hash;
  };

  window.htpRouter.render = render;

  window.addEventListener("load", render);
  window.addEventListener("hashchange", render);

  console.log("[HTP Router] 14 screens registered. Hash SPA ready.");
})();
