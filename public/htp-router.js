/* ══════════════════════════════════════════════
   HTP ROUTER v1.0 — 14-screen hash SPA
   No React. No build. Vanilla JS.
   ══════════════════════════════════════════════ */
(function(){
  "use strict";

  var API   = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
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
      var t = document.createElement("div"); t.className = "htp-toast";
      t.textContent = "Connect wallet first"; document.body.appendChild(t);
      setTimeout(function(){ t.remove(); }, 3000);
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
      "<tr><th>Players</th><td>" + (Array.isArray(g.players) ? g.players.length : (g.opponent ? 2 : 1)) + "/" + (g.max_players||"2") + "</td></tr>" +
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
    if (r.ok) {
      var t=document.createElement("div");t.className="htp-toast htp-toast-success";t.textContent="Joined! Game is now active.";document.body.appendChild(t);setTimeout(function(){t.remove()},4000);
      window.htpRouter.navigate("#/game/" + id);
      return;
    }
    var body; try { body = await r.json(); } catch(e) { body = {}; }
    var msg = body.error || ("Status " + r.status);
    if (r.status === 409) { msg = "Already joined"; }
    else if (r.status === 404) { msg = "Game no longer available"; }
    else { msg = "Join failed: " + msg; }
    var t=document.createElement("div");t.className="htp-toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},4000);
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
      try { var b = await api("/api/balance/" + addr); bal = b ? kasFromSompi(b.balance_sompi || 0) : "0.00"; }
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
      "<div class=\"htp-card\"><strong>Force Settle:</strong><input id=\"force-id\" class=\"htp-input\" placeholder=\"Game ID\"><button class=\"htp-btn\" style=\"margin-top:8px\" onclick=\"var d=document.createElement('div');d.className='htp-toast';d.textContent='Force settle requires guardian auth';document.body.appendChild(d);setTimeout(function(){d.remove()},4000)\">TRIGGER</button></div>");
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
    var r = document.getElementById("htp-root");
    if (!r) return;
    r.innerHTML = "<div class=htp-screen><h2>Status</h2><pre id=st>Loading...</pre></div>";
    var api = (window.HTP_CONFIG&&window.HTP_CONFIG.API_ORIGIN)||"https://hightable.pro";
    fetch(api+"/api/oracle/network").then(function(r){return r.json()}).then(function(d){
      var e=document.getElementById("st");if(e)e.textContent=JSON.stringify(d,null,2);
    }).catch(function(){});
  }

  // Market stake submission (wallet flow)
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
    var base = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
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
    var hash = window.location.hash.replace("#", "").replace(/^\//, "") || "lobby";
    if (!hash || hash === "/" || hash === "#" || hash === "") hash = "lobby";
    var parts = hash.split("/");
    var route = "/" + parts[0];
    var id    = parts[1] || null;

    // Find and highlight active nav link
    document.querySelectorAll(".nav-btn[data-v]").forEach(function(b) { var mapping = { overview: "markets", markets: "markets", create: "create", wallet: "wallet", oracle: "status", portfolio: "wallet" }; var expected = mapping[b.getAttribute("data-v")] || b.getAttribute("data-v"); b.classList.toggle("act", parts[0] === expected);
    });

    switch(route) {
      case "/overview":
    case "/lobby":       screenMarkets(); break;
      case "/create":      screenCreate(); break;
      case "/game":        screenGame(id); break;
      case "/settle":      screenSettle(id); break;
      case "/dispute":     screenDispute(id); break;
      case "/oracle":      screenOracle(); break;
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

  window.htpRouter.navigate = function(hash) {
    window.location.hash = hash;
  };

  window.htpRouter.render = render;

  window.addEventListener("load", render);
  window.addEventListener("hashchange", render);

  console.log("[HTP Router] 14 screens registered. Hash SPA ready.");
  window.registerOracleOp = registerOracleOp;
  window.submitOracleAttest = submitOracleAttest;
  window.submitOracleChallenge = submitOracleChallenge;
// ORACLE SCREEN FIX -- injected
window.screenOracle = async function() {
  var R = getRoot(); if(!R) return;
  var G = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">ORACLE NETWORK</h1><p class=\"htp-page-subtitle\">Bonded oracle nodes resolving outcomes on the Kaspa BlockDAG.</p><div class=\"htp-tab-bar\" id=\"or-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpOrSwitch(this,'dashboard')\">Dashboard</button><button class=\"htp-tab\" onclick=\"htpOrSwitch(this,'register')\">Register</button><button class=\"htp-tab\" onclick=\"htpOrSwitch(this,'attest')\">Attest</button></div><div id=\"or-content\"><p style=\"color:var(--muted)\">Loading...</p></div></div>";

  // Stat strip helper
  function statStrip(pairs) {
    return "<div class=\"htp-grid\" style=\"margin-bottom:20px\">" + pairs.map(function(p){return "<div class=\"htp-card\"><div class=\"htp-stat-label\">"+p[0]+"</div><div class=\"htp-stat-val\">"+p[1]+"</div></div>";}).join("") + "</div>";
  }

  // Dashboard
  async function dash(el) {
    el.innerHTML = "<p style=\"color:var(--muted)\">Loading network...</p>";
    try {
      var [nw, lst] = await Promise.all([
        fetch(G+"/api/oracle/network").then(function(r){return r.json();}),
        fetch(G+"/api/oracle/list").then(function(r){return r.json();})
      ]);
      var active = nw.oracles ? nw.oracles.active : 0;
      var total  = nw.oracles ? nw.oracles.total : 0;
      var nodes  = lst.oracles || [];
      el.innerHTML =
        statStrip([
          ["Active Nodes", active],
          ["Total Registered", total],
          ["Total Bond", nw.bond ? nw.bond.total_active_kas + " KAS" : "0 KAS"],
          ["Network", nw.network ? nw.network.toUpperCase() : "? "]
        ]) +
        (nodes.length ?
          "<h2 class=\"htp-section-title\">Registered Oracles</h2>" +
          "<div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>Address</th><th>Bond</th><th>Type</th><th>m/n</th><th>Slashes</th><th>Status</th></tr></thead><tbody>" +
          nodes.map(function(o){
            var s = (o.status||"active").toLowerCase();
            return "<tr><td style=\"font-family:monospace;font-size:.78rem\">"+(o.address||"").slice(0,14)+"\u2026</td>"+
              "<td style=\"font-weight:700\">"+((o.bond_sompi||0)/1e8).toFixed(2)+" KAS</td>"+
              "<td>"+(o.oracle_type||"?")+"</td><td>"+(o.m||"?")+"/"+(o.n||"?")+"</td>"+
              "<td>"+(o.slash_count||0)+"</td>"+
              "<td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td></tr>";
          }).join("") + "</tbody></table></div>"
          : "<p style=\"color:var(--muted)\">No oracles registered yet.</p>");
    } catch(e) { el.innerHTML = "<p style=\"color:#ff4444\">Failed to load: "+e.message+"</p>"; }
  }

  // Register
  function reg(el) {
    el.innerHTML = "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px\">Register Oracle Node</h2>"+
      "<p style=\"color:var(--muted);font-size:.85rem;margin:0 0 20px\">Bond KAS to become an oracle. Slashable if you attest falsely.</p>"+
      "<div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"or-addr\" class=\"htp-input\" placeholder=\"kaspatest:q...\" /></div>"+
      "<div class=\"htp-form-group\"><label>Bond (KAS)</label><input id=\"or-bond\" class=\"htp-input\" type=\"number\" placeholder=\"10\" min=\"1\" /></div>"+
      "<div class=\"htp-form-group\"><label>Type</label><select id=\"or-type\" class=\"htp-input\"><option value=\"hybrid\">Hybrid</option><option value=\"bond\">Bond</option><option value=\"zk\">ZK</option></select></div>"+
      "<button class=\"htp-btn\" onclick=\"htpRegOracle()\">Register on BlockDAG</button>"+
      "<div id=\"or-result\" style=\"margin-top:14px\"></div></div>";
    window.htpRegOracle = async function() {
      var addr = document.getElementById("or-addr").value.trim();
      var bond = parseFloat(document.getElementById("or-bond").value);
      var type = document.getElementById("or-type").value;
      var res  = document.getElementById("or-result");
      if (!addr || isNaN(bond) || bond <= 0) { res.innerHTML = "<p style=\"color:#ff4444\">Address and bond required.</p>"; return; }
      res.innerHTML = "<p style=\"color:var(--muted)\">Registering...</p>";
      try {
        var r = await fetch(G+"/api/oracle/register", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({address: addr, bond_sompi: Math.round(bond*1e8), oracle_type: type})
        });
        var d = await r.json();
        if (d.id) res.innerHTML = "<p style=\"color:#39ff90\">\u2713 Oracle registered: "+(d.address||"").slice(0,14)+"\u2026</p>";
        else res.innerHTML = "<p style=\"color:#ff4444\">"+(d.error||JSON.stringify(d))+"</p>";
      } catch(e) { res.innerHTML = "<p style=\"color:#ff4444\">Request failed.</p>"; }
    };
  }

  // Attest
  function att(el) {
    el.innerHTML = "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px\">Submit Attestation</h2>"+
      "<p style=\"color:var(--muted);font-size:.85rem;margin:0 0 20px\">Attest a game outcome. Bond at risk if quorum disagrees.</p>"+
      "<div class=\"htp-form-group\"><label>Game ID</label><input id=\"or-evid\" class=\"htp-input\" placeholder=\"game-id\" /></div>"+
      "<div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"or-oaddr\" class=\"htp-input\" placeholder=\"kaspatest:q...\" /></div>"+
      "<div class=\"htp-form-group\"><label>Winner Address</label><input id=\"or-winner\" class=\"htp-input\" placeholder=\"kaspatest:q...\" /></div>"+
      "<button class=\"htp-btn\" onclick=\"htpSubmitAtt()\">Submit Attestation</button>"+
      "<div id=\"or-result\" style=\"margin-top:14px\"></div></div>";
    window.htpSubmitAtt = async function() {
      var gid    = document.getElementById("or-evid").value.trim();
      var oaddr  = document.getElementById("or-oaddr").value.trim();
      var winner = document.getElementById("or-winner").value.trim();
      var res    = document.getElementById("or-result");
      if (!gid || !oaddr || !winner) { res.innerHTML = "<p style=\"color:#ff4444\">All fields required.</p>"; return; }
      res.innerHTML = "<p style=\"color:var(--muted)\">Submitting attestation...</p>";
      try {
        var r = await fetch(G+"/api/oracle/attest", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({game_id: gid, oracle_id: oaddr, oracle_addr: oaddr, winner: winner, proof_root: "0".repeat(64), attest_type: "oracle"})
        });
        var d = await r.json();
        if (d.id || d.status === "attested") res.innerHTML = "<p style=\"color:#39ff90\">\u2713 Attestation submitted.</p>";
        else res.innerHTML = "<p style=\"color:#ff4444\">"+(d.error||JSON.stringify(d))+"</p>";
      } catch(e) { res.innerHTML = "<p style=\"color:#ff4444\">Request failed.</p>"; }
    };
  }

  window.htpOrSwitch = function(btn, tab) {
    document.querySelectorAll("#or-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});
    btn.classList.add("htp-tab-act");
    var el = document.getElementById("or-content");
    if (tab === "dashboard") dash(el);
    else if (tab === "register") reg(el);
    else att(el);
  };

  dash(document.getElementById("or-content"));
};


window.screenWallet = screenWallet;
})();
(async function loadDashboardStats() {
  try {
    const BASE = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
    const [gamesRes, eventsRes, ordersRes] = await Promise.all([
      fetch(BASE + "/api/games").then(r => r.json()).catch(() => ({})),
      fetch(BASE + "/api/events").then(r => r.json()).catch(() => ({})),
      fetch(BASE + "/api/orders/stats").then(r => r.json()).catch(() => ({}))
    ]);
    const gamesCount = gamesRes.count ?? (Array.isArray(gamesRes) ? gamesRes.length : 0);
    const eventsCount = (eventsRes.events || []).length;
    const totalPool = (ordersRes.total_volume_sompi || 0) / 1e8;
    const els = {
      "[data-stat='total-pool']": totalPool.toFixed(2) + " KAS",
      "[data-stat='active-markets']": eventsCount,
      "[data-stat='positions']": gamesCount,
      ".stat-total-pool": totalPool.toFixed(2) + " KAS",
      ".stat-active-markets": eventsCount,
      ".stat-games": gamesCount,
      "#stat-pool": totalPool.toFixed(2) + " KAS",
      "#stat-markets": eventsCount,
      "#stat-games": gamesCount,
    };
    for (const [sel, val] of Object.entries(els)) {
      document.querySelectorAll(sel).forEach(el => { el.textContent = val; });
    }
  } catch(e) {}
})();
