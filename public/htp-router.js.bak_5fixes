/* ══════════════════════════════════════════════
   HTP ROUTER v1.1 — 14-screen hash SPA
   No React. No build. Vanilla JS.
   ══════════════════════════════════════════════ */
(function(){
  "use strict";

  var API   = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  var root  = null;
  var cache = {};
  var timers = {};

  function $(sel) { return document.querySelector(sel); }

  // ▸ FETCH helpers — unwraps {count, games:[]} OR bare array
  async function api(path) {
    try {
      var r = await fetch(API + path, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      var j = await r.json();
      // Unwrap paginated envelope
      if (j && !Array.isArray(j) && Array.isArray(j.games)) return j.games;
      return j;
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

  function _toast(msg, type) {
    var d = document.createElement("div");
    d.className = "htp-toast";
    if (type === "error") d.style.borderColor = "rgba(255,80,80,0.4)";
    if (type === "warn")  d.style.borderColor = "rgba(255,180,0,0.4)";
    if (type === "ok")    { d.style.borderColor = "rgba(0,255,135,0.4)"; d.className += " htp-toast-success"; }
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 4000);
  }
  window.htpRouter._toast = _toast;

  window.htpRouter._createGame = async function() {
    var type = document.getElementById("create-type").value;
    var fee  = document.getElementById("create-fee").value;
    var max  = document.getElementById("create-max").value;
    var creator = window.connectedAddress || window.htpAddress;
    if (!creator) {
      _toast("Connect wallet first", "error");
      window.htpRouter.navigate("#/wallet");
      return;
    }
    var body = { game_type: type, entry_fee_sompi: String(BigInt(Math.round(parseFloat(fee)*1e8))), max_players: parseInt(max), creator: creator };
    try {
      var r = await fetch(API + "/api/games", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      var j = await r.json();
      if (j && j.id) {
        window.htpRouter.navigate("#/game/" + j.id);
      } else {
        _toast("Error: " + (j.error || "Failed"), "error");
      }
    } catch(e) { _toast("Request failed: " + e.message, "error"); }
  };

  // ════════════════════════════════════════════
  // 3. #/game/:id
  // ════════════════════════════════════════════
  async function screenGame(id) {
    var g = await fetch(API + "/api/games/" + id).then(function(r){return r.json();}).catch(function(){return null;});
    if (!g) { root.innerHTML = page("GAME", "", empty("Game not found: " + id)); return; }
    var fee = kasFromSompi(g.stake_sompi || g.entry_fee_sompi || g.entry_fee || 0);
    var myAddr = window.connectedAddress || window.htpAddress;
    var canJoin = g.status === "open" && myAddr && g.creator !== myAddr;
    root.innerHTML = page("GAME #" + id.slice(-8), "Status: " + badge(g.status),
      "<div class=\"htp-card\">" +
      "<table class=\"htp-table\"><tr><th>Type</th><td>" + (g.game_type||g.type||"Match") + "</td></tr>" +
      "<tr><th>Entry Fee</th><td style=\"color:var(--htp-gold);font-weight:700\">" + fee + " KAS</td></tr>" +
      "<tr><th>Players</th><td>" + (Array.isArray(g.players) ? g.players.length : (g.opponent ? 2 : 1)) + "/" + (g.max_players||"2") + "</td></tr>" +
      "<tr><th>Creator</th><td style=\"font-family:var(--htp-font);font-size:11px\">" + (g.creator||"?") + "</td></tr>" +
      "<tr><th>Status</th><td>" + badge(g.status) + "</td></tr>" +
      "</table>" +
      (canJoin ? "<button class=\"htp-btn\" style=\"margin-top:16px\" onclick=\"window.htpRouter._joinGame('"+id+"')\">JOIN MATCH</button>" : "") +
      "</div>");
    clearInterval(timers["game_"+id]);
    timers["game_"+id] = setInterval(function(){ screenGame(id); }, 5000);
  }

  window.htpRouter._joinGame = async function(id) {
    var addr = window.connectedAddress || window.htpAddress;
    if (!addr) { _toast("Connect wallet first", "error"); return; }
    var r = await fetch(API + "/api/games/" + id + "/join", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({player: addr}) });
    if (r.ok) {
      _toast("Joined! Game is now active.", "ok");
      window.htpRouter.navigate("#/game/" + id);
      return;
    }
    var body; try { body = await r.json(); } catch(e) { body = {}; }
    var msg = body.error || ("Status " + r.status);
    if (r.status === 409) msg = "Already joined";
    else if (r.status === 404) msg = "Game no longer available";
    _toast("Join failed: " + msg, "error");
  };

  // ════════════════════════════════════════════
  // 4. #/settle/:id
  // ════════════════════════════════════════════
  async function screenSettle(id) {
    var g = await fetch(API + "/api/games/" + id).then(function(r){return r.json();}).catch(function(){return null;});
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
    if (!w) { _toast("Enter winner address", "warn"); return; }
    var r = await fetch(API + "/api/games/" + id + "/propose", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({winner: w, proof_root: "0".repeat(64), settlement_path: p})
    });
    var j = await r.json();
    _toast("Attestation: " + (j.attestation_hash ? j.attestation_hash.slice(0,16)+"..." : "FAILED"), j.attestation_hash ? "ok" : "error");
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
    _toast(j.status || JSON.stringify(j));
  };

  window.htpRouter._guardianOverride = async function(id) {
    var r = await fetch(API + "/api/games/" + id + "/guardian", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action: "override", guardian: window.connectedAddress}) });
    var txt = await r.text();
    _toast("Guardian: " + txt);
  };

  // ════════════════════════════════════════════
  // 6. #/wallet
  // ════════════════════════════════════════════
  async function screenWallet() {
    var addr = window.connectedAddress || window.htpAddress || null;
    var bal = "0.00";
    if (addr) {
      try { var b = await fetch(API + "/api/balance/" + addr).then(function(r){return r.json();}); bal = b ? kasFromSompi(b.balance_sompi || 0) : "0.00"; }
      catch(e) { bal = "error"; }
    }
    root.innerHTML = page("WALLET", "Manage your Kaspa identity",
      "<div class=\"htp-card\" style=\"max-width:500px\">" +
      (addr ? "<div style=\"margin-bottom:16px\"><label class=\"htp-label\">Address</label><div class=\"htp-code\" style=\"word-break:break-all\">" + addr + "</div></div>" : "") +
      "<div style=\"margin-bottom:16px\"><label class=\"htp-label\">Balance</label><strong style=\"font-size:24px;color:var(--htp-gold)\">" + bal + " KAS</strong></div>" +
      "<textarea id=\"mnemonic-input\" placeholder=\"word1 word2 ... word12\" style=\"width:100%;height:64px;padding:10px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;font-family:monospace;font-size:12px;box-sizing:border-box;resize:vertical;margin-bottom:10px\"></textarea>" +
      "<button class=\"htp-btn\" style=\"width:100%;margin-bottom:6px\" onclick=\"try{window.htpWalletV3.importMnemonic()}catch(e){}\">IMPORT MNEMONIC</button>" +
      "<button class=\"htp-btn htp-btn-ghost\" style=\"width:100%;margin-bottom:6px\" onclick=\"try{window.htpWalletV3.generateWallet()}catch(e){}\">GENERATE WALLET</button>" +
      (addr ? "<button class=\"htp-btn htp-btn-ghost\" style=\"width:100%\" onclick=\"window.htpWalletV3.disconnect()\">DISCONNECT</button>" : "") +
      "</div>");
  }

  // ════════════════════════════════════════════
  // 7. #/markets
  // ════════════════════════════════════════════
  async function screenMarkets() {
    var games = await api("/api/games?type=parimutuel");
    // api() already unwraps {games:[]} envelope — games is now array or null
    var list = Array.isArray(games) ? games.filter(function(g){ return g.game_type === "ParimutuelMarket"; }) : [];
    if (!list.length) {
      root.innerHTML = page("MARKETS", "Prediction markets on Kaspa Testnet",
        empty("No prediction markets open yet. <a href=\"#/create\" style=\"color:var(--htp-gold)\">Create one</a>"));
      return;
    }
    var cards = list.map(function(m) {
      return "<div class=\"htp-card\" onclick=\"window.htpRouter.navigate('#/market/" + m.id + "')\" style=\"cursor:pointer\">" +
        "<strong>⬡ " + (m.title||"Prediction Market") + "</strong> " + badge(m.status) +
        "<div style=\"font-size:11px;color:var(--htp-muted);margin-top:6px\">Pool: " + kasFromSompi(m.stake_sompi||0) + " KAS</div>" +
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
    var m = await fetch(API + "/api/games/" + id).then(function(r){return r.json();}).catch(function(){return null;});
    if (!m) { root.innerHTML = page("MARKET", "", empty("Market not found")); return; }
    root.innerHTML = page("MARKET", (m.title||"Prediction Market") + " — Pool: " + kasFromSompi(m.stake_sompi||0) + " KAS",
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
    var list = Array.isArray(games) ? games.filter(function(g){ return g.game_type === "TournamentBracket"; }) : [];
    if (!list.length) {
      root.innerHTML = page("TOURNAMENTS", "Bracket competitions",
        empty("No tournaments open yet. <a href=\"#/create\" style=\"color:var(--htp-gold)\">Create one</a>"));
      return;
    }
    var cards = list.map(function(t) {
      return "<div class=\"htp-card\" onclick=\"window.htpRouter.navigate('#/tournament/" + t.id + "')\" style=\"cursor:pointer\">" +
        "<strong>◈ Tournament</strong> " + badge(t.status) +
        "<div style=\"font-size:11px;color:var(--htp-muted);margin-top:6px\">Players: " + (t.players||0) + "/" + (t.max_players||8) + " | Prize: " + kasFromSompi(t.stake_sompi||0) + " KAS</div>" +
        "</div>";
    }).join("");
    root.innerHTML = page("TOURNAMENTS", "Bracket competitions",
      "<div class=\"htp-grid\">" + cards + "</div>");
  }

  // ════════════════════════════════════════════
  // 10. #/tournament/:id
  // ════════════════════════════════════════════
  async function screenTournamentId(id) {
    var t = await fetch(API + "/api/games/" + id).then(function(r){return r.json();}).catch(function(){return null;});
    if (!t) { root.innerHTML = page("TOURNAMENT", "", empty("Tournament not found")); return; }
    var fee = (t.stake_sompi || 0) / 1e8;
    var prize = fee * (t.max_players || 8);
    var players = [];
    try {
      if (t.player_list) players = JSON.parse(t.player_list);
      else if (t.players) players = Array.isArray(t.players) ? t.players : [];
    } catch(e) {}
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
      html += '<div style="margin-top:16px;padding:12px;background:rgba(201,168,76,0.1);border:1px solid var(--htp-gold);border-radius:var(--htp-radius)"><strong style="color:var(--htp-gold)">WINNER:</strong> ' + (t.winner ? shortAddr(t.winner) : "Unknown") + '</div>';
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
      "<div class=\"htp-card\"><strong>Force Settle:</strong><input id=\"force-id\" class=\"htp-input\" placeholder=\"Game ID\"><button class=\"htp-btn\" style=\"margin-top:8px\" onclick=\"_toast('Force settle requires guardian auth','warn')\">TRIGGER</button></div>");
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
      "<li>Match completes \u2192 arbiter proposes outcome</li>" +
      "<li>Dispute window (N blocks) \u2192 challenge or finalize</li>" +
      "<li>Guardian window \u2192 override if dispute unresolved</li>" +
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
      "<a href=\"https://explorer-tn12.kaspa.org/txs/" + txid + "\" target=\"_blank\" style=\"color:var(--htp-gold);font-size:12px\">View on TN12 Explorer \u2197</a></div>");
  }

  // ════════════════════════════════════════════
  // 14. #/status
  // ════════════════════════════════════════════
  async function screenStatus() {
    var r = document.getElementById("htp-root");
    if (!r) return;
    r.innerHTML = "<div class=htp-screen><h2>Status</h2><pre id=st>Loading...</pre></div>";
    fetch(API+"/api/oracle/network").then(function(r){return r.json();}).then(function(d){
      var e=document.getElementById("st");if(e)e.textContent=JSON.stringify(d,null,2);
    }).catch(function(){});
  }

  // Market stake submission
  window.htpRouter._placeStake = async function(id) {
    var addr = window.connectedAddress || window.htpAddress;
    if (!addr) {
      try { if (window.htpWalletV3 && window.htpWalletV3.showConnectModal) window.htpWalletV3.showConnectModal(); } catch(e) {}
      _toast("Connect wallet first", "error"); return;
    }
    var outcomeEl = document.getElementById("market-outcome");
    var amountEl  = document.getElementById("market-amount");
    if (!outcomeEl || !amountEl) { _toast("Form elements missing", "error"); return; }
    var outcome = outcomeEl.value;
    var amount  = parseFloat(amountEl.value || "0.5");
    if (isNaN(amount) || amount <= 0) { _toast("Invalid amount", "warn"); return; }
    var sompi = String(Math.round(amount * 1e8));
    try {
      var r = await fetch(API + "/api/games/" + id + "/join", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({player: addr, outcome: outcome, stake_sompi: sompi})
      });
      var j = await r.json();
      if (j && j.message) _toast("Stake recorded — " + j.message, "ok");
    } catch(e) { _toast("Failed: " + e.message, "error"); }
  };

  // ROUTER ENGINE
  function render() {
    root = root || document.getElementById("htp-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "htp-root";
      var shell = document.querySelector(".shell") || document.body;
      shell.insertBefore(root, shell.firstChild);
    }
    var hash = window.location.hash.replace("#", "").replace(/^\//, "") || "lobby";
    if (!hash || hash === "/" || hash === "#" || hash === "") hash = "lobby";
    var parts = hash.split("/");
    var route = "/" + parts[0];
    var id    = parts[1] || null;

    document.querySelectorAll(".nav-btn[data-v]").forEach(function(b) {
      var mapping = { overview: "markets", markets: "markets", create: "create", wallet: "wallet", oracle: "oracle", portfolio: "wallet" };
      var expected = mapping[b.getAttribute("data-v")] || b.getAttribute("data-v");
      b.classList.toggle("act", parts[0] === expected);
    });

    switch(route) {
      case "/overview":
      case "/lobby":       screenMarkets(); break;
      case "/create":      screenCreate(); break;
      case "/game":        screenGame(id); break;
      case "/settle":      screenSettle(id); break;
      case "/dispute":     screenDispute(id); break;
      case "/oracle":      window.screenOracle ? window.screenOracle() : screenStatus(); break;
      case "/wallet":      screenWallet(); break;
      case "/markets":     screenMarkets(); break;
      case "/market":      screenMarket(id); break;
      case "/tournament":  id ? screenTournamentId(id) : screenTournament(); break;
      case "/admin":       screenAdmin(); break;
      case "/docs":        screenDocs(); break;
      case "/tx":          screenTx(id); break;
      case "/status":      screenStatus(); break;
      default:             window.htpRouter.navigate("#/markets"); break;
    }
  }

  window.htpRouter.navigate = function(hash) { window.location.hash = hash; };
  window.htpRouter.render = render;
  window.addEventListener("load", render);
  window.addEventListener("hashchange", render);

// ════════════════════════════════════════════
// ORACLE NETWORK SCREEN — v2
// Miner attestation + human attestation + slashing/contest
// ════════════════════════════════════════════
window.screenOracle = async function() {
  var R = document.getElementById("htp-root"); if (!R) return;
  var G = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";

  R.innerHTML = [
    '<div class="htp-page">',
    '<h1 class="htp-page-title">ORACLE NETWORK</h1>',
    '<p class="htp-page-subtitle">Bonded oracle nodes resolving outcomes on the Kaspa BlockDAG. Bond is slashed if quorum contests your attestation.</p>',
    '<div class="htp-tab-bar" id="or-tabs">',
      '<button class="htp-tab htp-tab-act" onclick="htpOrTab(this,\'dashboard\')">Dashboard</button>',
      '<button class="htp-tab" onclick="htpOrTab(this,\'register\')">Register Node</button>',
      '<button class="htp-tab" onclick="htpOrTab(this,\'attest\')">Attest Outcome</button>',
      '<button class="htp-tab" onclick="htpOrTab(this,\'contest\')">Contest / Slash</button>',
      '<button class="htp-tab" onclick="htpOrTab(this,\'pending\')">Pending Disputes</button>',
    '</div>',
    '<div id="or-content" style="margin-top:20px"><p style="color:var(--htp-muted)">Loading...</p></div>',
    '</div>'
  ].join("");

  // ── stat strip ──
  function statStrip(pairs) {
    return '<div class="htp-grid" style="margin-bottom:20px">' +
      pairs.map(function(p){ return '<div class="htp-card"><div class="htp-stat-label">' + p[0] + '</div><div class="htp-stat-val">' + p[1] + '</div></div>'; }).join("") +
      '</div>';
  }

  // ── DASHBOARD ──
  async function tabDashboard(el) {
    el.innerHTML = '<p style="color:var(--htp-muted)">Loading network...</p>';
    try {
      var nw  = await fetch(G+"/api/oracle/network").then(function(r){return r.json();});
      var lst = await fetch(G+"/api/oracle/list").then(function(r){return r.json();});
      var nodes = lst.oracles || [];
      el.innerHTML =
        statStrip([
          ["Active Nodes",     (nw.oracles && nw.oracles.active)  || 0],
          ["Total Registered", (nw.oracles && nw.oracles.total)   || 0],
          ["Total Bond",       (nw.bond    && nw.bond.total_active_kas) ? nw.bond.total_active_kas + " KAS" : "0 KAS"],
          ["Network",          (nw.network || "tn12").toUpperCase()]
        ]) +
        (nodes.length ?
          '<h2 class="htp-section-title" style="margin-bottom:12px">Registered Oracles</h2>' +
          '<div style="overflow-x:auto"><table class="htp-table"><thead><tr>' +
            '<th>Address</th><th>Bond</th><th>Type</th><th>m/n</th><th>Slashes</th><th>Status</th><th></th>' +
          '</tr></thead><tbody>' +
          nodes.map(function(o){
            var s = (o.status||"active").toLowerCase();
            return '<tr>' +
              '<td style="font-family:monospace;font-size:.78rem">' + (o.address||"").slice(0,18) + '\u2026</td>' +
              '<td style="font-weight:700">' + ((o.bond_sompi||0)/1e8).toFixed(2) + ' KAS</td>' +
              '<td>' + (o.oracle_type||"hybrid") + '</td>' +
              '<td>' + (o.m||"?") + '/' + (o.n||"?") + '</td>' +
              '<td style="color:' + (o.slash_count > 0 ? '#ff6b6b' : 'inherit') + '">' + (o.slash_count||0) + '</td>' +
              '<td><span class="htp-badge htp-badge-' + s + '">' + s.toUpperCase() + '</span></td>' +
              '<td><button class="htp-btn htp-btn-ghost htp-btn-sm" onclick="htpOrContestNode(\'' + (o.address||o.id) + '\')">Contest</button></td>' +
              '</tr>';
          }).join("") +
          '</tbody></table></div>'
          : '<p style="color:var(--htp-muted)">No oracles registered yet.</p>');
    } catch(e) { el.innerHTML = '<p style="color:#ff4444">Failed to load: ' + e.message + '</p>'; }
  }

  // ── REGISTER NODE ──
  function tabRegister(el) {
    el.innerHTML = [
      '<div class="htp-form-card">',
      '<h2 style="margin:0 0 8px">Register Oracle Node</h2>',
      '<p style="color:var(--htp-muted);font-size:.85rem;margin:0 0 20px">',
        'Bond KAS as collateral. Your bond is slashed if you attest a false outcome and quorum disagrees.',
      '</p>',
      '<div class="htp-form-group"><label>Your Kaspa Address</label>',
        '<input id="or-addr" class="htp-input" placeholder="kaspatest:q..." /></div>',
      '<div class="htp-form-group"><label>Bond Amount (KAS)</label>',
        '<input id="or-bond" class="htp-input" type="number" placeholder="10" min="1" /></div>',
      '<div class="htp-form-group"><label>Oracle Type</label>',
        '<select id="or-type" class="htp-input">',
          '<option value="hybrid">Hybrid (miner + human)</option>',
          '<option value="miner">Miner auto-attest (script)</option>',
          '<option value="human">Human arbiter</option>',
          '<option value="zk">ZK proof verifier</option>',
        '</select></div>',
      '<div class="htp-form-group"><label>Quorum m (min signers)</label>',
        '<input id="or-m" class="htp-input" type="number" placeholder="2" min="1" /></div>',
      '<div class="htp-form-group"><label>Quorum n (total signers)</label>',
        '<input id="or-n" class="htp-input" type="number" placeholder="3" min="1" /></div>',
      '<button class="htp-btn" onclick="htpRegOracle()">Register on BlockDAG</button>',
      '<div id="or-result" style="margin-top:14px"></div>',
      '</div>'
    ].join("");

    window.htpRegOracle = async function() {
      var addr = document.getElementById("or-addr").value.trim();
      var bond = parseFloat(document.getElementById("or-bond").value);
      var type = document.getElementById("or-type").value;
      var m    = parseInt(document.getElementById("or-m").value) || 2;
      var n    = parseInt(document.getElementById("or-n").value) || 3;
      var res  = document.getElementById("or-result");
      if (!addr || isNaN(bond) || bond <= 0) { res.innerHTML = '<p style="color:#ff4444">Address and bond required.</p>'; return; }
      if (m > n) { res.innerHTML = '<p style="color:#ff4444">m cannot exceed n.</p>'; return; }
      res.innerHTML = '<p style="color:var(--htp-muted)">Registering...</p>';
      try {
        var r = await fetch(G+"/api/oracle/register", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({address: addr, bond_sompi: Math.round(bond*1e8), oracle_type: type, m: m, n: n})
        });
        var d = await r.json();
        if (d.id || d.address) {
          res.innerHTML = '<p style="color:#00ff87">\u2713 Oracle registered. ID: ' + (d.id||d.address).slice(0,20) + '</p>';
        } else {
          res.innerHTML = '<p style="color:#ff4444">' + (d.error||JSON.stringify(d)) + '</p>';
        }
      } catch(e) { res.innerHTML = '<p style="color:#ff4444">Request failed: ' + e.message + '</p>'; }
    };
  }

  // ── ATTEST OUTCOME ──
  function tabAttest(el) {
    el.innerHTML = [
      '<div class="htp-form-card">',
      '<h2 style="margin:0 0 8px">Submit Attestation</h2>',
      '<p style="color:var(--htp-muted);font-size:.85rem;margin:0 0 20px">',
        'Attest the winner of a game. Your bond is at risk if quorum contests this within the dispute window.',
      '</p>',
      '<div class="htp-form-group"><label>Game ID</label>',
        '<input id="or-evid" class="htp-input" placeholder="game-uuid or id" /></div>',
      '<div class="htp-form-group"><label>Your Oracle Address</label>',
        '<input id="or-oaddr" class="htp-input" placeholder="kaspatest:q..." /></div>',
      '<div class="htp-form-group"><label>Winner Address</label>',
        '<input id="or-winner" class="htp-input" placeholder="kaspatest:q..." /></div>',
      '<div class="htp-form-group"><label>Attestation Type</label>',
        '<select id="or-atype" class="htp-input">',
          '<option value="oracle">Oracle (standard)</option>',
          '<option value="miner_script">Miner script auto-attest</option>',
          '<option value="human">Human arbiter</option>',
          '<option value="zk">ZK proof</option>',
        '</select></div>',
      '<button class="htp-btn" onclick="htpSubmitAtt()">Submit Attestation</button>',
      '<div id="or-att-result" style="margin-top:14px"></div>',
      '</div>'
    ].join("");

    window.htpSubmitAtt = async function() {
      var gid    = document.getElementById("or-evid").value.trim();
      var oaddr  = document.getElementById("or-oaddr").value.trim();
      var winner = document.getElementById("or-winner").value.trim();
      var atype  = document.getElementById("or-atype").value;
      var res    = document.getElementById("or-att-result");
      if (!gid || !oaddr || !winner) { res.innerHTML = '<p style="color:#ff4444">All fields required.</p>'; return; }
      res.innerHTML = '<p style="color:var(--htp-muted)">Submitting attestation...</p>';
      try {
        var r = await fetch(G+"/api/oracle/attest", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({game_id: gid, oracle_id: oaddr, oracle_addr: oaddr, winner: winner, proof_root: "0".repeat(64), attest_type: atype})
        });
        var d = await r.json();
        if (d.id || d.status === "attested") {
          res.innerHTML = '<p style="color:#00ff87">\u2713 Attestation submitted. Window: ' + (d.dispute_window_blocks||"N/A") + ' blocks to contest.</p>';
        } else {
          res.innerHTML = '<p style="color:#ff4444">' + (d.error||JSON.stringify(d)) + '</p>';
        }
      } catch(e) { res.innerHTML = '<p style="color:#ff4444">Request failed: ' + e.message + '</p>'; }
    };
  }

  // ── CONTEST / SLASH ──
  function tabContest(el) {
    el.innerHTML = [
      '<div class="htp-form-card">',
      '<h2 style="margin:0 0 8px">Contest Attestation</h2>',
      '<p style="color:var(--htp-muted);font-size:.85rem;margin:0 0 20px">',
        'If an oracle attested a false outcome, contest it here within the dispute window. ',
        'If quorum agrees the attestation was wrong, the oracle\u2019s bond is slashed and redistributed.',
      '</p>',
      '<div class="htp-form-group"><label>Game ID</label>',
        '<input id="ct-gid" class="htp-input" placeholder="game-uuid" /></div>',
      '<div class="htp-form-group"><label>Your Address (contestant)</label>',
        '<input id="ct-addr" class="htp-input" placeholder="kaspatest:q..." /></div>',
      '<div class="htp-form-group"><label>Correct Winner (your claim)</label>',
        '<input id="ct-winner" class="htp-input" placeholder="kaspatest:q..." /></div>',
      '<div class="htp-form-group"><label>Evidence / Reason</label>',
        '<textarea id="ct-reason" class="htp-input" rows="3" placeholder="Explain why the attestation is wrong..."></textarea></div>',
      '<button class="htp-btn" style="background:rgba(255,100,100,0.15);border-color:rgba(255,100,100,0.4)" onclick="htpContestAtt()">\u26A0 Submit Contest</button>',
      '<div id="ct-result" style="margin-top:14px"></div>',
      '<hr style="border-color:var(--htp-border);margin:24px 0" />',
      '<h2 style="margin:0 0 8px">Slash Oracle Bond</h2>',
      '<p style="color:var(--htp-muted);font-size:.85rem;margin:0 0 20px">',
        'After the dispute window closes, if the contest won, trigger bond slashing here.',
      '</p>',
      '<div class="htp-form-group"><label>Oracle Address to Slash</label>',
        '<input id="sl-addr" class="htp-input" placeholder="kaspatest:q..." /></div>',
      '<div class="htp-form-group"><label>Game ID</label>',
        '<input id="sl-gid" class="htp-input" placeholder="game-uuid" /></div>',
      '<button class="htp-btn" style="background:rgba(255,60,60,0.2);border-color:rgba(255,60,60,0.5)" onclick="htpSlashOracle()">\u2718 Execute Slash</button>',
      '<div id="sl-result" style="margin-top:14px"></div>',
      '</div>'
    ].join("");

    window.htpContestAtt = async function() {
      var gid    = document.getElementById("ct-gid").value.trim();
      var addr   = document.getElementById("ct-addr").value.trim();
      var winner = document.getElementById("ct-winner").value.trim();
      var reason = document.getElementById("ct-reason").value.trim();
      var res    = document.getElementById("ct-result");
      if (!gid || !addr || !winner) { res.innerHTML = '<p style="color:#ff4444">Game ID, your address and correct winner are required.</p>'; return; }
      res.innerHTML = '<p style="color:var(--htp-muted)">Submitting contest...</p>';
      try {
        var r = await fetch(G+"/api/oracle/contest", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({game_id: gid, contestant: addr, claimed_winner: winner, reason: reason})
        });
        var d = await r.json();
        if (d.id || d.status) {
          res.innerHTML = '<p style="color:#00ff87">\u2713 Contest submitted. Status: ' + (d.status||"pending") + '. Dispute window: ' + (d.dispute_window_blocks||"N/A") + ' blocks.</p>';
        } else {
          res.innerHTML = '<p style="color:#ff4444">' + (d.error||JSON.stringify(d)) + '</p>';
        }
      } catch(e) { res.innerHTML = '<p style="color:#ff4444">Request failed: ' + e.message + '</p>'; }
    };

    window.htpSlashOracle = async function() {
      var oaddr  = document.getElementById("sl-addr").value.trim();
      var gid    = document.getElementById("sl-gid").value.trim();
      var res    = document.getElementById("sl-result");
      if (!oaddr || !gid) { res.innerHTML = '<p style="color:#ff4444">Oracle address and game ID required.</p>'; return; }
      res.innerHTML = '<p style="color:var(--htp-muted)">Executing slash...</p>';
      try {
        var r = await fetch(G+"/api/oracle/slash", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({oracle_address: oaddr, game_id: gid, initiator: window.connectedAddress || ""})
        });
        var d = await r.json();
        if (d.slashed || d.status) {
          res.innerHTML = '<p style="color:#ff6b6b">\u26A1 Slash executed. Bond slashed: ' + ((d.slashed_sompi||0)/1e8).toFixed(2) + ' KAS.</p>';
        } else {
          res.innerHTML = '<p style="color:#ff4444">' + (d.error||JSON.stringify(d)) + '</p>';
        }
      } catch(e) { res.innerHTML = '<p style="color:#ff4444">Request failed: ' + e.message + '</p>'; }
    };

    window.htpOrContestNode = function(addr) {
      document.getElementById("sl-addr").value = addr;
      document.querySelectorAll("#or-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});
      var tabs = document.querySelectorAll("#or-tabs .htp-tab");
      if (tabs[3]) tabs[3].classList.add("htp-tab-act");
      tabContest(document.getElementById("or-content"));
      setTimeout(function(){ document.getElementById("sl-addr").value = addr; }, 50);
    };
  }

  // ── PENDING DISPUTES ──
  async function tabPending(el) {
    el.innerHTML = '<p style="color:var(--htp-muted)">Loading disputes...</p>';
    try {
      var r = await fetch(G+"/api/oracle/disputes").then(function(r){return r.json();});
      var disputes = r.disputes || r || [];
      if (!Array.isArray(disputes) || !disputes.length) {
        el.innerHTML = '<div class="htp-empty"><div class="htp-empty-icon">\u2714</div>No pending disputes. All attestations confirmed.</div>';
        return;
      }
      el.innerHTML =
        '<h2 class="htp-section-title" style="margin-bottom:12px">Open Disputes (' + disputes.length + ')</h2>' +
        '<div style="overflow-x:auto"><table class="htp-table"><thead><tr>' +
          '<th>Game ID</th><th>Oracle</th><th>Attested Winner</th><th>Contest Winner</th><th>Window</th><th>Status</th><th></th>' +
        '</tr></thead><tbody>' +
        disputes.map(function(d){
          return '<tr>' +
            '<td style="font-family:monospace;font-size:.78rem">' + (d.game_id||"").slice(0,12) + '\u2026</td>' +
            '<td style="font-family:monospace;font-size:.78rem">' + (d.oracle_addr||"").slice(0,14) + '\u2026</td>' +
            '<td style="color:var(--htp-gold);font-family:monospace;font-size:.78rem">' + (d.attested_winner||"").slice(0,14) + '\u2026</td>' +
            '<td style="color:#ff6b6b;font-family:monospace;font-size:.78rem">' + (d.claimed_winner||"").slice(0,14) + '\u2026</td>' +
            '<td>' + (d.blocks_remaining !== undefined ? d.blocks_remaining + " blk" : "?") + '</td>' +
            '<td><span class="htp-badge htp-badge-disputed">' + (d.status||"DISPUTED").toUpperCase() + '</span></td>' +
            '<td><button class="htp-btn htp-btn-ghost htp-btn-sm" onclick="htpSlashFromDispute(\'' + d.game_id + '\',\'' + (d.oracle_addr||"") + \')">Slash</button></td>' +
            '</tr>';
        }).join("") +
        '</tbody></table></div>';

      window.htpSlashFromDispute = async function(gid, oaddr) {
        try {
          var r = await fetch(G+"/api/oracle/slash", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({oracle_address: oaddr, game_id: gid, initiator: window.connectedAddress||""})
          });
          var d = await r.json();
          _toast(d.slashed ? "\u26A1 Slashed: " + ((d.slashed_sompi||0)/1e8).toFixed(2) + " KAS" : (d.error||"Slash failed"), d.slashed ? "ok" : "error");
          tabPending(el);
        } catch(e) { _toast("Slash failed: " + e.message, "error"); }
      };
    } catch(e) { el.innerHTML = '<p style="color:#ff4444">Failed to load disputes: ' + e.message + '</p>'; }
  }

  // ── TAB SWITCHER ──
  window.htpOrTab = function(btn, tab) {
    document.querySelectorAll("#or-tabs .htp-tab").forEach(function(b){ b.classList.remove("htp-tab-act"); });
    btn.classList.add("htp-tab-act");
    var el = document.getElementById("or-content");
    if (tab === "dashboard")  tabDashboard(el);
    else if (tab === "register") tabRegister(el);
    else if (tab === "attest")   tabAttest(el);
    else if (tab === "contest")  tabContest(el);
    else if (tab === "pending")  tabPending(el);
  };

  // Default to dashboard
  tabDashboard(document.getElementById("or-content"));
};

window.screenWallet = screenWallet;
})();

// ── Dashboard stats ──
(async function loadDashboardStats() {
  try {
    var BASE = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
    var gamesRes  = await fetch(BASE + "/api/games").then(function(r){return r.json();}).catch(function(){return {};});
    var eventsRes = await fetch(BASE + "/api/events").then(function(r){return r.json();}).catch(function(){return {};});
    var ordersRes = await fetch(BASE + "/api/orders/stats").then(function(r){return r.json();}).catch(function(){return {};});
    var gamesCount  = gamesRes.count != null ? gamesRes.count : (Array.isArray(gamesRes) ? gamesRes.length : 0);
    var eventsCount = (eventsRes.events || []).length;
    var totalPool   = (ordersRes.total_volume_sompi || 0) / 1e8;
    var els = {
      "[data-stat='total-pool']": totalPool.toFixed(2) + " KAS",
      "[data-stat='active-markets']": eventsCount,
      "[data-stat='positions']": gamesCount,
      ".stat-total-pool": totalPool.toFixed(2) + " KAS",
      ".stat-active-markets": eventsCount,
      ".stat-games": gamesCount,
      "#stat-pool": totalPool.toFixed(2) + " KAS",
      "#stat-markets": eventsCount,
      "#stat-games": gamesCount
    };
    for (var sel in els) {
      document.querySelectorAll(sel).forEach(function(el){ el.textContent = els[sel]; });
    }
  } catch(e) {}
})();

// ── Events screen ──
window.screenEvents = async function() {
  var R = document.getElementById("htp-root"); if (!R) return;
  R.innerHTML = '<div class="htp-page"><h1 class="htp-page-title">EVENTS</h1><p class="htp-page-subtitle">Skill-based prediction events on the Kaspa BlockDAG.</p><div id="ev-list"><p style="color:var(--htp-muted)">Loading...</p></div></div>';
  try {
    var r = await fetch("https://hightable.pro/api/events");
    var d = await r.json();
    var evs = Array.isArray(d) ? d : (d.events || []);
    var el2 = document.getElementById("ev-list");
    if (!el2) return;
    if (!evs.length) { el2.innerHTML = '<p style="color:var(--htp-muted)">No events yet.</p>'; return; }
    el2.innerHTML = '<div class="htp-grid">' + evs.map(function(e){
      return '<div class="htp-card"><div class="htp-stat-label">' + (e.category||"event").toUpperCase() + '</div>' +
        '<div style="font-weight:700;margin:6px 0">' + (e.title||e.question||e.id||"Event") + '</div>' +
        '<div style="color:var(--htp-muted);font-size:.82rem">' + (e.description||"") + '</div>' +
        '<div style="margin-top:10px"><span class="htp-badge htp-badge-' + (e.status||"active").toLowerCase() + '">' + (e.status||"ACTIVE").toUpperCase() + '</span></div></div>';
    }).join("") + '</div>';
  } catch(err) {
    var el3 = document.getElementById("ev-list");
    if (el3) el3.innerHTML = '<p style="color:#ff4444">' + err.message + '</p>';
  }
};

// ── Portfolio screen ──
window.screenPortfolio = async function() {
  var R = document.getElementById("htp-root"); if (!R) return;
  R.innerHTML = '<div class="htp-page"><h1 class="htp-page-title">PORTFOLIO</h1><p class="htp-page-subtitle">Your match history and KAS balance on TN12.</p><div id="port-content"><p style="color:var(--htp-muted)">Loading...</p></div></div>';
  var el = document.getElementById("port-content");
  if (!el) return;
  var addr = (window.htpWallet && window.htpWallet.address) || window.selectedAddress || window.connectedAddress || null;
  if (!addr) {
    el.innerHTML = '<div class="htp-card" style="text-align:center;padding:32px"><p style="color:var(--htp-muted);margin-bottom:16px">Connect your wallet to view your portfolio.</p></div>';
    return;
  }
  try {
    var r = await fetch("https://hightable.pro/api/portfolio?address=" + encodeURIComponent(addr));
    var d = await r.json();
    var rows = Array.isArray(d) ? d : (d.matches || d.positions || d.history || []);
    if (!rows.length) { el.innerHTML = '<p style="color:var(--htp-muted)">No match history yet.</p>'; return; }
    el.innerHTML = '<div class="htp-grid">' + rows.map(function(m){
      var won = m.winner === addr;
      return '<div class="htp-card"><div class="htp-stat-label">' + (m.game||"match").toUpperCase() + '</div>' +
        '<div style="font-weight:700;margin:6px 0">' + (m.id||m.matchId||"Match") + '</div>' +
        '<div style="color:var(--htp-muted);font-size:.82rem">Wager: ' + (m.wager||m.amount||"?") + ' KAS</div>' +
        '<span class="htp-badge htp-badge-' + (won?"win":"loss") + '">' + (won?"WIN":"LOSS") + '</span></div>';
    }).join("") + '</div>';
  } catch(err) {
    if (el) el.innerHTML = '<p style="color:#ff4444">' + err.message + '</p>';
  }
};

// ── Games screen ──
window.screenGames = function() {
  var R = document.getElementById("htp-root"); if (!R) return;
  R.innerHTML = '<div class="htp-page"><h1 class="htp-page-title">SKILL GAMES</h1><p class="htp-page-subtitle">Skill-based games with KAS wagering on TN12.</p>' +
    '<div class="htp-grid" style="margin-top:24px">' +
      '<div class="htp-card" style="cursor:pointer;text-align:center" onclick="if(typeof window.screenChess===\'function\')window.screenChess();else go(\'chess\')"><div style="font-size:2.5rem;margin-bottom:12px">&#9822;</div><div style="font-weight:700;font-size:1.1rem">CHESS</div><div style="color:var(--htp-muted);font-size:.82rem;margin-top:6px">Classic chess. Winner takes the pot.</div></div>' +
      '<div class="htp-card" style="cursor:pointer;text-align:center" onclick="if(typeof window.screenConnect4===\'function\')window.screenConnect4();else go(\'connect4\')"><div style="font-size:2.5rem;margin-bottom:12px">&#128308;</div><div style="font-weight:700;font-size:1.1rem">CONNECT 4</div><div style="color:var(--htp-muted);font-size:.82rem;margin-top:6px">Four in a row on the BlockDAG.</div></div>' +
      '<div class="htp-card" style="cursor:pointer;text-align:center" onclick="if(typeof window.screenCheckers===\'function\')window.screenCheckers();else go(\'checkers\')"><div style="font-size:2.5rem;margin-bottom:12px">&#9924;</div><div style="font-weight:700;font-size:1.1rem">CHECKERS</div><div style="color:var(--htp-muted);font-size:.82rem;margin-top:6px">Classic checkers. Non-custodial.</div></div>' +
    '</div></div>';
};
