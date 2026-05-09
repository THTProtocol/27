// HTP Router — Complete (v11)
// 7 nav screens. BlockDAG is the referee.
(function() {

var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
var root = null;
var timers = {};

function getRoot() {
  return root || (root = document.getElementById("htp-root"));
}

async function api(path, opts) {
  try {
    var r = await fetch(B + path,
      Object.assign({ signal: AbortSignal.timeout(8000) }, opts || {}));
    return await r.json();
  } catch(e) { return null; }
}

function kas(s)   { return s ? (Number(s)/1e8).toFixed(2)+" KAS" : "0.00 KAS"; }
function addr(a)  { return a ? a.slice(0,9)+"\u2026"+a.slice(-6) : "—"; }
function fmtDate(ts) { return ts ? new Date(ts*1000).toLocaleDateString() : "—"; }

function badge(s) {
  var cls = { open:"open", active:"active", pending:"active",
              settled:"settled", disputed:"disputed",
              matched:"active", cancelled:"settled",
              capped:"settled", reached:"active" };
  return "<span class=\"htp-badge htp-badge-"
    +(cls[(s||"").toLowerCase()]||"settled")+"\">"
    +(s||"?").toUpperCase()+"</span>";
}

function page(title, sub, html) {
  return "<div class=\"htp-page\">"
    +"<h1 class=\"htp-page-title\">"+title+"</h1>"
    +(sub?"<p class=\"htp-page-subtitle\">"+sub+"</p>":"")
    +html+"</div>";
}

function statStrip(pairs) {
  return "<div class=\"htp-grid\" style=\"margin-bottom:20px\">"
    +pairs.map(function(p){
      return "<div class=\"htp-card\">"
        +"<div style=\"font-size:.65rem;color:var(--htp-muted);text-transform:uppercase;"
        +"letter-spacing:1px;margin-bottom:4px\">"+p[0]+"</div>"
        +"<div style=\"font-size:1.25rem;font-weight:800;color:var(--htp-gold)\">"+p[1]+"</div>"
        +(p[2]?"<div style=\"font-size:.7rem;color:var(--htp-muted)\">"+p[2]+"</div>":"")
        +"</div>";
    }).join("")+"</div>";
}

function tabBar(id, labels, active) {
  return "<div class=\"htp-tab-bar\" id=\"tb-"+id+"\">"
    +labels.map(function(l,i){
      return "<button class=\"htp-tab"+(i===active?" htp-tab-act":"")
        +"\" onclick=\"htpTab('"+id+"',"+i+")\">"+l+"</button>";
    }).join("")+"</div>";
}
function tabPanels(id, htmlArr) {
  return "<div id=\"tp-"+id+"\">"
    +htmlArr.map(function(h,i){
      return "<div class=\"htp-panel\" style=\"display:"+(i===0?"block":"none")+"\">"+h+"</div>";
    }).join("")+"</div>";
}
window.htpTab = function(id, idx) {
  var bar = document.getElementById("tb-"+id);
  var pnl = document.getElementById("tp-"+id);
  if(!bar||!pnl) return;
  bar.querySelectorAll(".htp-tab").forEach(function(t,i){
    t.className = "htp-tab"+(i===idx?" htp-tab-act":"");
  });
  pnl.querySelectorAll(".htp-panel").forEach(function(p,i){
    p.style.display = i===idx?"block":"none";
  });
};

function emptyState(msg) {
  return "<div class=\"htp-empty\"><div class=\"htp-empty-icon\">◈</div>"+msg+"</div>";
}

function toast(msg, type) {
  var d = document.createElement("div");
  d.className = "htp-toast"+(type==="ok"?" htp-toast-success":"");
  if(type==="error") d.style.borderColor = "rgba(255,80,80,0.4)";
  if(type==="warn")  d.style.borderColor = "rgba(255,180,0,0.4)";
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ d.remove(); }, 4000);
}

function navigate(hash) { window.location.hash = hash; }
window.navigate = navigate;
window.htpRouter = window.htpRouter || {};
window.htpRouter.navigate = navigate;
window.htpRouter._toast = toast;

// ═══ SCREEN: Overview ═══
window.screenOverview = async function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  var ov = document.getElementById("v-overview");
  if (ov) ov.style.display = "block";
  var shell = document.querySelector(".shell-main");
  if (shell) shell.style.display = "block";
  try {
    var res = await Promise.all([
      fetch(B + "/api/games?limit=1").then(function(r){return r.json();}),
      fetch(B + "/api/events").then(function(r){return r.json();}),
      fetch(B + "/api/orders/stats").then(function(r){return r.json();}),
      fetch(B + "/api/oracle/network").then(function(r){return r.json();})
    ]);
    var gCount = (res[0] && res[0].count) || 0;
    var eCount = (res[1] && Array.isArray(res[1].events)) ? res[1].events.length : 0;
    var oCount = (res[2] && res[2].open_count) || 0;
    var nCount = (res[3] && (res[3].active_oracles || res[3].oracles)) || 0;
    var el;
    el = document.getElementById("statPool");    if (el) el.textContent = gCount + " Games";
    el = document.getElementById("statMarkets"); if (el) el.textContent = eCount + " Events";
    el = document.getElementById("statEntrants"); if (el) el.textContent = oCount + " Orders";
    el = document.getElementById("statAvgMult"); if (el) el.textContent = nCount + " Oracles";
  } catch(e) { console.warn("screenOverview:", e); }
}
window.screenOverview = screenOverview;
;

// ═══ SCREEN: Events ═══
window.screenEvents = async function() {
  var r = getRoot();
  var ev = await api("/api/events");
  var os = await api("/api/orders/stats");
  var events = ev ? (Array.isArray(ev.events)?ev.events:[]) : [];
  var browse = events.length ?
    "<table class=\"htp-table\"><thead><tr><th>Title</th><th>Fee</th><th>Pool</th><th>Status</th><th></th></tr></thead><tbody>"
    +events.map(function(e){return "<tr><td>"+(e.title||"?")+"</td><td>"+kas(e.entry_fee_sompi||0)+"</td>"
      +"<td>"+kas(e.gross_pot_sompi||0)+"</td><td>"+badge(e.status)+"</td>"
      +"<td><button class=\"htp-btn\" onclick=\"navigate('#/game/"+e.id+"')\">View</button></td></tr>";}).join("")
    +"</tbody></table>"
    : emptyState("No events yet. Create one →");
  var create = "<div class=\"htp-card\" style=\"max-width:500px;padding:16px\">"
    +"<input id=\"ev-title\" class=\"htp-input\" placeholder=\"Title\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"ev-desc\" class=\"htp-input\" placeholder=\"Description\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"ev-outcomes\" class=\"htp-input\" placeholder=\"Outcomes: Yes, No\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"ev-fee\" class=\"htp-input\" type=\"number\" placeholder=\"Entry Fee (KAS)\" value=\"0.5\" step=\"0.1\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"ev-max\" class=\"htp-input\" type=\"number\" placeholder=\"Max Players\" value=\"16\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"window.createEvent()\">Create Event</button>"
    +"<div id=\"ev-result\" style=\"margin-top:12px\"></div></div>";
  r.innerHTML = page("EVENTS",
    "Prediction markets and information resolution on the Kaspa BlockDAG.",
    statStrip([
      ["Open Events", events.length],
      ["Total Pool (KAS)", ((os?os.total_volume_sompi||0:0)/1e8).toFixed(2)],
      ["Open Orders", os?os.open_count||0:0]
    ])
    +tabBar("ev", ["Browse Events","Create Event"], 0)
    +tabPanels("ev", [browse, create])
  );
  window.createEvent = async function() {
    var body = { title: document.getElementById("ev-title").value,
      outcomes: (document.getElementById("ev-outcomes").value||"Yes,No").split(",").map(function(x){return x.trim();}),
      entry_fee_sompi: Math.round(parseFloat(document.getElementById("ev-fee").value||"0.5")*1e8),
      max_players: parseInt(document.getElementById("ev-max").value||"16"),
      creator: window.connectedAddress || window.htpAddress || "anon" };
    try {
      var resp = await fetch(B+"/api/events", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      var d = await resp.json();
      var el = document.getElementById("ev-result");
      if (d.id) { el.innerHTML = "<p style=\"color:var(--htp-gold)\">Created: "+d.id+"</p>"; navigate("#/game/"+d.id); }
      else el.innerHTML = "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("ev-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
};

// ═══ SCREEN: Create ═══
window.screenCreate = async function() {
  var r = getRoot();
  var pools = await api("/api/maximizer/pools");
  var poolList = pools && pools.pools ? pools.pools.map(function(p){
    var pct = p.pool_cap_sompi>0?Math.round(p.current_sompi*100/p.pool_cap_sompi):0;
    return "<div class=\"htp-card\" style=\"padding:12px;margin-bottom:8px\"><div style=\"display:flex;justify-content:space-between\">"
      +"<span><strong>"+p.game_type+"</strong> "+(p.current_sompi/1e8).toFixed(2)+"/"+(p.pool_cap_sompi/1e8).toFixed(2)+" KAS</span>"
      +"<span>"+badge(p.status)+"</span></div>"
      +"<div style=\"background:var(--htp-bg);border-radius:4px;height:6px;margin:6px 0\"><div style=\"background:var(--htp-gold);height:6px;border-radius:4px;width:"+pct+"%\"></div></div></div>";
  }).join("") : emptyState("No pools yet.");

  var skillForm = "<div class=\"htp-card\" style=\"max-width:500px;padding:16px\">"
    +"<select id=\"sk-type\" class=\"htp-input\" style=\"width:100%;margin-bottom:8px\">"
    +"<option value=\"chess\">Chess</option><option value=\"poker\">Poker</option>"
    +"<option value=\"checkers\">Checkers</option><option value=\"connect4\">Connect4</option></select>"
    +"<input id=\"sk-wager\" class=\"htp-input\" type=\"number\" placeholder=\"Wager (sompi)\" value=\"100000000\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"sk-pa\" class=\"htp-input\" placeholder=\"Your Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"sk-pb\" class=\"htp-input\" placeholder=\"Opponent Address (optional)\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"window.createSkillGame()\">Create Match</button>"
    +"<div id=\"sk-result\" style=\"margin-top:12px\"></div></div>";
  window.createSkillGame = async function() {
    var body = { game_type: document.getElementById("sk-type").value,
      player_a: document.getElementById("sk-pa").value||(window.connectedAddress||window.htpAddress||"anon"),
      player_b: document.getElementById("sk-pb").value||null,
      wager_sompi: parseInt(document.getElementById("sk-wager").value||"100000000"),
      creator: document.getElementById("sk-pa").value||(window.connectedAddress||window.htpAddress||"anon") };
    try {
      var resp = await fetch(B+"/api/games", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      var d = await resp.json();
      if (d.id) { document.getElementById("sk-result").innerHTML = "<p style=\"color:var(--htp-gold)\">Created: "+d.id+"</p>"; navigate("#/game/"+d.id); }
      else document.getElementById("sk-result").innerHTML = "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("sk-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
  var poolForm = "<div class=\"htp-card\" style=\"max-width:500px;padding:16px\">"
    +"<select id=\"mx-type\" class=\"htp-input\" style=\"width:100%;margin-bottom:8px\">"
    +"<option value=\"chess\">Chess</option><option value=\"poker\">Poker</option></select>"
    +"<input id=\"mx-cap\" class=\"htp-input\" type=\"number\" placeholder=\"Pool Cap (KAS)\" value=\"10\" step=\"1\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"mx-min\" class=\"htp-input\" type=\"number\" placeholder=\"Min Bet (KAS)\" value=\"0.1\" step=\"0.1\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"mx-max\" class=\"htp-input\" type=\"number\" placeholder=\"Max Bet (KAS)\" value=\"5\" step=\"0.1\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"window.createMaxPool()\">Create Pool</button>"
    +"<div id=\"mx-result\" style=\"margin-top:12px\"></div></div>";
  window.createMaxPool = async function() {
    var body = { game_type: document.getElementById("mx-type").value,
      pool_cap_sompi: Math.round(parseFloat(document.getElementById("mx-cap").value||"10")*1e8),
      min_bet_sompi: Math.round(parseFloat(document.getElementById("mx-min").value||"0.1")*1e8),
      max_bet_sompi: Math.round(parseFloat(document.getElementById("mx-max").value||"5")*1e8) };
    try {
      var resp = await fetch(B+"/api/maximizer/pools/create", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      var d = await resp.json();
      if (d.id) { document.getElementById("mx-result").innerHTML = "<p style=\"color:var(--htp-gold)\">Created: "+d.id+"</p>"; setTimeout(function(){window.screenCreate();},1500); }
      else document.getElementById("mx-result").innerHTML = "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("mx-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
  r.innerHTML = page("CREATE MATCH",
    "Propose a new covenant game on the Kaspa BlockDAG.",
    tabBar("cr", ["Skill Match","Pool List","Maximizer Pool"], 0)
    +tabPanels("cr", [skillForm, poolList, poolForm])
  );
};

// ═══ SCREEN: Games ═══
window.screenGames = async function() {
  var r = getRoot();
  var g    = await api("/api/games?limit=100");
  var os   = await api("/api/orders/stats");
  var ords = await api("/api/orders");
  var games = g ? (Array.isArray(g.games)?g.games:[]) : [];
  var orders = ords ? (Array.isArray(ords.orders)?ords.orders:[]) : [];
  var allTab = games.length ?
    "<table class=\"htp-table\"><thead><tr><th>ID</th><th>Type</th><th>Player A</th><th>Player B</th><th>Wager</th><th>Status</th><th>Winner</th></tr></thead><tbody>"
    +games.map(function(gm){return "<tr onclick=\"navigate('#/game/"+gm.id+"')\" style=\"cursor:pointer\">"
      +"<td style=\"font-family:monospace\">"+(gm.id||"").slice(-8)+"</td><td>"+(gm.game_type||"?")+"</td>"
      +"<td>"+addr(gm.creator)+"</td><td>"+addr(gm.opponent)+"</td><td>"+kas(gm.stake_sompi)+"</td>"
      +"<td>"+badge(gm.status)+"</td><td>"+addr(gm.winner)+"</td></tr>";}).join("")
    +"</tbody></table>"
    : emptyState("No games yet.");
  var bookTab = orders.length ?
    "<table class=\"htp-table\"><thead><tr><th>ID</th><th>Player</th><th>Type</th><th>Wager</th><th>Status</th><th></th></tr></thead><tbody>"
    +orders.map(function(o){return "<tr><td style=\"font-family:monospace\">"+(o.id||"").slice(-12)+"</td>"
      +"<td>"+addr(o.creator)+"</td><td>"+(o.game_type||"?")+"</td><td>"+kas(o.stake_sompi)+"</td><td>"+badge(o.status)+"</td>"
      +"<td><button class=\"htp-btn\" onclick=\"var a=prompt('Your address?'); fetch(B+'/api/orders/"+o.id+"/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matcher:a})}); setTimeout(function(){window.screenGames();},1000);\">Match</button></td></tr>";}).join("")
    +"</tbody></table>"
    : emptyState("No open orders.");
  var postForm = "<div class=\"htp-card\" style=\"max-width:500px;padding:16px\">"
    +"<input id=\"op-addr\" class=\"htp-input\" placeholder=\"Your Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<select id=\"op-type\" class=\"htp-input\" style=\"width:100%;margin-bottom:8px\"><option value=\"chess\">Chess</option></select>"
    +"<input id=\"op-wager\" class=\"htp-input\" type=\"number\" placeholder=\"Wager (sompi)\" value=\"100000000\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"window.postOrder()\">Post Order</button>"
    +"<div id=\"op-result\" style=\"margin-top:12px\"></div></div>";
  window.postOrder = async function() {
    var body = { creator: document.getElementById("op-addr").value||(window.connectedAddress||"anon"),
      order_type: "game", game_type: document.getElementById("op-type").value,
      stake_sompi: parseInt(document.getElementById("op-wager").value||"100000000") };
    try {
      var resp = await fetch(B+"/api/orders", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      var d = await resp.json();
      if (d.id) { document.getElementById("op-result").innerHTML = "<p style=\"color:var(--htp-gold)\">Posted: "+d.id+"</p>"; setTimeout(function(){window.screenGames();},1000); }
      else document.getElementById("op-result").innerHTML = "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("op-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
  r.innerHTML = page("GAMES",
    "All skill-based matches on the Kaspa BlockDAG.",
    statStrip([
      ["Total Games", games.length],
      ["Active", games.filter(function(gm){return gm.status==="open"||gm.status==="active";}).length],
      ["Settled", games.filter(function(gm){return gm.status==="settled";}).length],
      ["Volume (KAS)", ((os?os.total_volume_sompi||0:0)/1e8).toFixed(2)]
    ])
    +tabBar("gm", ["All Games","Order Book","Post Order"], 0)
    +tabPanels("gm", [allTab, bookTab, postForm])
  );
  if (timers.games) clearInterval(timers.games);
  timers.games = setInterval(function(){ window.screenGames(); }, 15000);
};

// ═══ SCREEN: Game Detail ═══
window.screenGame = async function(id) {
  var r = getRoot();
  if (!id) { r.innerHTML = emptyState("No game ID"); return; }
  var g = await api("/api/games/"+id);
  if (!g || g.error) { r.innerHTML = emptyState("Game not found: "+id); return; }
  var html = page("GAME: "+id.slice(-8),
    "Match details and settlement status.",
    "<div class=\"htp-card\" style=\"padding:16px;margin-bottom:16px\">"
    +"<p><strong>Type:</strong> "+(g.game_type||"?")+"</p>"
    +"<p><strong>Creator:</strong> "+addr(g.creator)+"</p>"
    +"<p><strong>Opponent:</strong> <span style=\"color:var(--accent)\">"+addr(g.opponent)+"</span></p>"
    +"<p><strong>Wager:</strong> "+kas(g.stake_sompi)+"</p>"
    +"<p><strong>Status:</strong> "+badge(g.status)+"</p>"
    +(g.winner?"<p><strong>Winner:</strong> <span style=\"color:var(--htp-gold);font-weight:700\">"+addr(g.winner)+"</span></p>":"")
    +"</div>"
    +(g.status==="open"?"<button class=\"htp-btn\" onclick=\"var a=prompt('Your address?'); if(a) fetch(B+'/api/games/"+id+"/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:a})}).then(function(){window.screenGame('"+id+"');});\">Join Match</button>":"")
    +" <a href=\"#/settle/"+id+"\" class=\"htp-btn\">Settle →</a>"
  );
  r.innerHTML = html;
  if (timers["game_"+id]) clearInterval(timers["game_"+id]);
  timers["game_"+id] = setInterval(function(){ window.screenGame(id); }, 5000);
};

// ═══ SCREEN: Oracle Network ═══
window.screenOracle = async function() {
  var r = getRoot();
  var net = await api("/api/oracle/network");
  var lst = await api("/api/oracle/list");
  var oracles = lst ? (Array.isArray(lst.oracles)?lst.oracles:[]) : [];
  var dashboard = oracles.length ?
    "<table class=\"htp-table\"><thead><tr><th>ID</th><th>Address</th><th>Bond</th><th>Type</th><th>m/n</th><th>Slashes</th><th>Status</th></tr></thead><tbody>"
    +oracles.map(function(o){return "<tr><td style=\"font-family:monospace\">"+(o.id||o.pubkey||"").slice(-10)+"</td>"
      +"<td>"+addr(o.address||o.pubkey)+"</td><td>"+kas(o.bond_sompi)+"</td>"
      +"<td>"+(o.oracle_type||o.operator_type||"?")+"</td><td>"+(o.quorum_m||"?")+"/"+(o.quorum_n||"?")+"</td>"
      +"<td>"+(o.slash_count||0)+"</td><td>"+badge(o.status||(o.is_active?"active":"inactive"))+"</td></tr>";}).join("")
    +"</tbody></table>"
    : emptyState("No oracles registered yet.");
  var regForm = "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\">"
    +"<input id=\"or-addr\" class=\"htp-input\" placeholder=\"Oracle Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<select id=\"or-type\" class=\"htp-input\" style=\"width:100%;margin-bottom:8px\"><option value=\"hybrid\">Hybrid</option><option value=\"bond\">Bond</option><option value=\"zk\">ZK</option></select>"
    +"<input id=\"or-bond\" class=\"htp-input\" type=\"number\" placeholder=\"Bond (sompi)\" value=\"500000000\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"or-m\" class=\"htp-input\" type=\"number\" placeholder=\"M (required)\" value=\"2\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"or-n\" class=\"htp-input\" type=\"number\" placeholder=\"N (total)\" value=\"3\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"window.oracleRegister()\">Register Oracle</button>"
    +"<div id=\"or-result\" style=\"margin-top:12px\"></div></div>";
  window.oracleRegister = async function() {
    try {
      var resp = await fetch(B+"/api/oracle/register", {method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ address: document.getElementById("or-addr").value,
          oracle_type: document.getElementById("or-type").value,
          bond_sompi: parseInt(document.getElementById("or-bond").value||"500000000"),
          quorum_m: parseInt(document.getElementById("or-m").value||"2"),
          quorum_n: parseInt(document.getElementById("or-n").value||"3") })});
      var d = await resp.json();
      document.getElementById("or-result").innerHTML = d.id ? "<p style=\"color:var(--htp-gold)\">Registered: "+d.id+"</p>" : "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("or-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
  var attForm = "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\">"
    +"<input id=\"oa-game\" class=\"htp-input\" placeholder=\"Game ID\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"oa-id\" class=\"htp-input\" placeholder=\"Oracle ID\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"oa-addr\" class=\"htp-input\" placeholder=\"Oracle Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"oa-winner\" class=\"htp-input\" placeholder=\"Winner Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"window.oracleAttest()\">Submit Attestation</button>"
    +"<div id=\"oa-result\" style=\"margin-top:12px\"></div></div>";
  window.oracleAttest = async function() {
    try {
      var resp = await fetch(B+"/api/oracle/attest", {method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ game_id: document.getElementById("oa-game").value,
          oracle_id: document.getElementById("oa-id").value,
          oracle_addr: document.getElementById("oa-addr").value,
          winner: document.getElementById("oa-winner").value,
          proof_root: "0".repeat(64), attest_type: "oracle" })});
      var d = await resp.json();
      document.getElementById("oa-result").innerHTML = d.attested_count ? "<p style=\"color:var(--htp-gold)\">Attested! "+d.attested_count+"/"+d.required+" ✓</p>" : "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("oa-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
  var qForm = "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\">"
    +"<input id=\"oq-game\" class=\"htp-input\" placeholder=\"Game ID\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"var gid=document.getElementById('oq-game').value; fetch(B+'/api/oracle/quorum/'+gid).then(function(r){return r.json();}).then(function(d){document.getElementById('oq-result').textContent=JSON.stringify(d,null,2);});\">Check Quorum</button>"
    +"<pre id=\"oq-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px;font-size:0.8rem\"></pre></div>";
  var slForm = "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\">"
    +"<input id=\"os-id\" class=\"htp-input\" placeholder=\"Oracle ID\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"os-game\" class=\"htp-input\" placeholder=\"Game ID\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"os-reason\" class=\"htp-input\" placeholder=\"Reason\" value=\"attested_wrong_winner\" style=\"width:100%;margin-bottom:8px\">"
    +"<input id=\"os-reporter\" class=\"htp-input\" placeholder=\"Reporter Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" style=\"background:rgba(255,80,80,0.15);border-color:rgba(255,80,80,0.3);color:#f66\" onclick=\"window.oracleSlash()\">Report Slash</button>"
    +"<div id=\"os-result\" style=\"margin-top:12px\"></div></div>";
  window.oracleSlash = async function() {
    try {
      var resp = await fetch(B+"/api/oracle/slash", {method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ oracle_id: document.getElementById("os-id").value,
          game_id: document.getElementById("os-game").value,
          reason: document.getElementById("os-reason").value,
          reported_by: document.getElementById("os-reporter").value })});
      var d = await resp.json();
      document.getElementById("os-result").innerHTML = d.slashed_sompi ? "<p style=\"color:#f90\">Slashed: "+kas(d.slashed_sompi)+"</p>" : "<p style=\"color:#f66\">"+JSON.stringify(d)+"</p>";
    } catch(e) { document.getElementById("os-result").innerHTML = "<p style=\"color:#f66\">"+e.message+"</p>"; }
  };
  r.innerHTML = page("ORACLE NETWORK",
    "m-of-n bonded oracles. Register · Bond · Attest · Slash. All on the Kaspa BlockDAG.",
    statStrip([
      ["Active Oracles", net?net.oracles?net.oracles.active:0:0],
      ["Total", net?net.oracles?net.oracles.total:0:0],
      ["Total Bond", ((net?net.bond?net.bond.total_active_sompi||0:0:0)/1e8).toFixed(2)+" KAS"],
      ["Attestations", net?net.attestations?net.attestations.total||0:0:0]
    ])
    +tabBar("or", ["Dashboard","Register","Attest","Quorum","Slash"], 0)
    +tabPanels("or", [dashboard, regForm, attForm, qForm, slForm])
  );
};

// ═══ SCREEN: Portfolio ═══
window.screenPortfolio = async function() {
  var r = getRoot();
  var addr = window.connectedAddress || window.htpAddress || "";
  if (!addr) {
    r.innerHTML = page("PORTFOLIO","",
      "<div class=\"htp-card\" style=\"text-align:center;padding:32px;max-width:400px;margin:0 auto\">"
      +"<p>Connect your wallet to view portfolio.</p>"
      +"<button class=\"htp-btn\" onclick=\"navigate('#/wallet')\">Connect Wallet</button></div>");
    return;
  }
  var pf = await api("/api/portfolio/"+addr);
  if (!pf || pf.error) { r.innerHTML = emptyState("Could not load portfolio"); return; }
  var games = Array.isArray(pf.games) ? pf.games : [];
  r.innerHTML = page("PORTFOLIO",
    "Your on-chain activity on the Kaspa BlockDAG.",
    "<p style=\"margin-bottom:12px;font-family:monospace\">"+addr(addr)+" <small style=\"color:var(--htp-muted)\">("+addr+"</small>)</p>"
    +statStrip([
      ["Total Wagered", kas(pf.total_wagered_sompi)],
      ["Total Won", kas(pf.total_won_sompi)],
      ["Wins", pf.win_count||0],
      ["Losses", pf.loss_count||0]
    ])
    +(games.length ?
      "<table class=\"htp-table\"><thead><tr><th>ID</th><th>Type</th><th>Opponent</th><th>Wager</th><th>Result</th><th>Status</th></tr></thead><tbody>"
      +games.map(function(g){return "<tr onclick=\"navigate('#/game/"+g.id+"')\" style=\"cursor:pointer\">"
        +"<td style=\"font-family:monospace\">"+(g.id||"").slice(-8)+"</td><td>"+(g.game_type||"?")+"</td>"
        +"<td>"+addr(g.creator===addr?g.opponent:g.creator)+"</td><td>"+kas(g.stake_sompi)+"</td>"
        +"<td>"+(g.winner===addr?"<span style=\"color:var(--htp-gold)\">W</span>":g.winner?"L":"—")+"</td><td>"+badge(g.status)+"</td></tr>";}).join("")
      +"</tbody></table>"
      : emptyState("No activity yet. Create or join a game →"))
    +"<button class=\"htp-btn\" onclick=\"window.screenPortfolio()\" style=\"margin-top:12px\">Refresh</button>"
  );
  if (timers.portfolio) clearInterval(timers.portfolio);
  timers.portfolio = setInterval(function(){ window.screenPortfolio(); }, 30000);
};

// ═══ SCREEN: Wallet ═══
window.screenWallet = function() {
  // Keep existing wallet logic. If screenWallet exists from another file, use it.
  // Otherwise show a basic connect prompt.
  if (typeof window._originalScreenWallet === "function") {
    window._originalScreenWallet();
    return;
  }
  var r = getRoot();
  r.innerHTML = page("WALLET","Connect or import a Kaspa address.",
    "<div class=\"htp-card\" style=\"max-width:400px;margin:0 auto;text-align:center;padding:32px\">"
    +"<input id=\"wallet-addr\" class=\"htp-input\" placeholder=\"Your Kaspa testnet address\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"var a=document.getElementById('wallet-addr').value; if(a){window.connectedAddress=a;window.htpAddress=a;navigate('#/portfolio');}\">Connect</button>"
    +"<p style=\"margin-top:16px;color:var(--htp-muted);font-size:0.8rem\">Currently on Kaspa Testnet (TN12). No real funds.</p></div>");
};

// ═══ SCREEN: Settle ═══
window.screenSettle = async function(id) {
  var r = getRoot();
  if (!id) { r.innerHTML = emptyState("No game ID"); return; }
  r.innerHTML = page("SETTLE","",
    "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\">"
    +"<p>Game: <strong>"+id+"</strong></p>"
    +"<input id=\"st-winner\" class=\"htp-input\" placeholder=\"Winner Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"var w=document.getElementById('st-winner').value; if(w) fetch(B+'/api/games/"+id+"/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winner:w})}).then(function(r){return r.json();}).then(function(d){document.getElementById('st-result').textContent=JSON.stringify(d,null,2);});\">Propose Settlement</button>"
    +"<pre id=\"st-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px;font-size:0.8rem\"></pre></div>");
};

// ═══ SCREEN: Dispute ═══
window.screenDispute = async function(id) {
  var r = getRoot();
  if (!id) { r.innerHTML = emptyState("No game ID"); return; }
  r.innerHTML = page("DISPUTE","",
    "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\">"
    +"<p>Game: <strong>"+id+"</strong></p>"
    +"<input id=\"dp-addr\" class=\"htp-input\" placeholder=\"Your Address\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" style=\"background:rgba(255,80,80,0.15);border-color:rgba(255,80,80,0.3);color:#f66\" onclick=\"var a=document.getElementById('dp-addr').value; if(a) fetch(B+'/api/games/"+id+"/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenger:a})}).then(function(r){return r.json();}).then(function(d){document.getElementById('dp-result').textContent=JSON.stringify(d,null,2);});\">Challenge</button>"
    +"<pre id=\"dp-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px;font-size:0.8rem\"></pre></div>");
};

// ═══ SCREEN: Admin ═══
window.screenAdmin = function() {
  var r = getRoot();
  r.innerHTML = page("ADMIN","",
    "<div class=\"htp-card\" style=\"max-width:400px;margin:0 auto;text-align:center;padding:32px\">"
    +"<input id=\"admin-key\" class=\"htp-input\" type=\"password\" placeholder=\"Admin Key\" style=\"width:100%;margin-bottom:8px\">"
    +"<button class=\"htp-btn\" onclick=\"var k=document.getElementById('admin-key').value; if(k) fetch(B+'/api/admin/stats',{headers:{'x-admin-key':k}}).then(function(r){return r.json();}).then(function(d){document.getElementById('admin-result').textContent=JSON.stringify(d,null,2);});\">View Stats</button>"
    +"<pre id=\"admin-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px;font-size:0.8rem\"></pre></div>");
};

// ═══ SCREEN: Docs ═══
window.screenDocs = function() {
  var r = getRoot();
  r.innerHTML = page("DOCS","Architecture and on-DAG infrastructure.",
    "<div class=\"htp-card\" style=\"padding:16px;margin-bottom:12px\"><h3>Stack</h3>"
    +"<table class=\"htp-table\"><tbody>"
    +"<tr><td><strong>Backend</strong></td><td>Rust (axum + sqlx + sqlite) — ≥80% of codebase</td></tr>"
    +"<tr><td><strong>Frontend</strong></td><td>Vanilla JS, no framework, no build step</td></tr>"
    +"<tr><td><strong>Network</strong></td><td>Kaspa TN12 → Mainnet</td></tr>"
    +"<tr><td><strong>Oracles</strong></td><td>m-of-n bonded, slashable, on-DAG</td></tr>"
    +"<tr><td><strong>Settler</strong></td><td>Rust auto-settler daemon every 30 seconds</td></tr>"
    +"<tr><td><strong>Consensus</strong></td><td>GHOSTDAG, 10 BPS, sub-second inclusion</td></tr></tbody></table></div>"
    +"<div class=\"htp-card\" style=\"padding:16px\"><h3>Contracts</h3>"
    +"<table class=\"htp-table\"><thead><tr><th>Covenant</th><th>Status</th><th>Opcode</th></tr></thead><tbody>"
    +"<tr><td>SkillGame escrow</td><td>"+badge("active")+"</td><td>P2PK</td></tr>"
    +"<tr><td>Oracle bond</td><td>"+badge("active")+"</td><td>OP_CHECKSIG</td></tr>"
    +"<tr><td>Toccata mainnet</td><td>"+badge("pending")+"</td><td>OP_TOCCATA</td></tr></tbody></table></div>");
};

// ═══ SCREEN: Transaction ═══
window.screenTx = function(id) {
  var r = getRoot();
  r.innerHTML = page("TX","",
    "<div class=\"htp-card\" style=\"padding:16px;text-align:center\"><p>Transaction: <strong>"+(id||"?")+"</strong></p>"
    +"<a class=\"htp-btn\" href=\"https://explorer-tn12.kaspa.org/txs/"+(id||"")+"\" target=\"_blank\">View on Explorer →</a></div>");
};

// ═══ RENDER ENGINE ═══
window.htpRouter.render = function() {
  // Hide all legacy hardcoded sections; only screenOverview may re-show them
  var legacy = document.querySelectorAll('section.view, main.shell-main, .shell-main');
  for (var i = 0; i < legacy.length; i++) legacy[i].style.display = 'none';

  root = document.getElementById("htp-root");
  // Hide legacy hardcoded sections on navigation
  var legacySections = document.querySelectorAll("section.view, main.shell-main, .shell-main, #v-overview, #v-markets, #v-create, #v-skill, #v-oracle, #v-orders, #v-portfolio, #v-wallet, #v-admin, #v-docs");
  for (var i = 0; i < legacySections.length; i++) {
    legacySections[i].style.display = "none";
  }

  if (!root) return;

  var hash = (window.location.hash || "").replace(/^#\/?/, "") || "overview";
  var parts = hash.split("/");
  var route = "/"+parts[0];
  var id = parts[1] || null;

  // Clear stale timers
  Object.keys(timers).forEach(function(k) {
    var keep = false;
    if (route==="/games"    && k==="games")    keep = true;
    if (route==="/portfolio"&& k==="portfolio") keep = true;
    if (route==="/game"     && k==="game_"+id)  keep = true;
    if (!keep) { clearInterval(timers[k]); delete timers[k]; }
  });

  // Nav active state
  var navMap = {
    "overview":"overview","events":"events","create":"create",
    "games":"games","game":"games","oracle":"oracle",
    "portfolio":"portfolio","wallet":"wallet"
  };
  document.querySelectorAll(".nav-btn[data-v]").forEach(function(b) {
    b.classList.toggle("act", b.getAttribute("data-v") === (navMap[parts[0]]||"overview"));
  });

  switch (route) {
    case "/overview":  if (window.screenOverview)  window.screenOverview();  break;
    case "/events":    if (window.screenEvents)    window.screenEvents();    break;
    case "/create":    if (window.screenCreate)    window.screenCreate();    break;
    case "/games":     if (window.screenGames)     window.screenGames();     break;
    case "/game":      if (window.screenGame)      window.screenGame(id);    break;
    case "/oracle":    if (window.screenOracle)    window.screenOracle();    break;
    case "/portfolio": if (window.screenPortfolio) window.screenPortfolio(); break;
    case "/wallet":    if (window.screenWallet)    window.screenWallet();    break;
    case "/settle":    if (window.screenSettle)    window.screenSettle(id);  break;
    case "/dispute":   if (window.screenDispute)   window.screenDispute(id); break;
    case "/admin":     if (window.screenAdmin)     window.screenAdmin();     break;
    case "/docs":      if (window.screenDocs)      window.screenDocs();      break;
    case "/tx":        if (window.screenTx)        window.screenTx(id);      break;
    default:           if (window.screenOverview)  window.screenOverview();  break;
  }
};

window.addEventListener("load", window.htpRouter.render);
window.addEventListener("hashchange", window.htpRouter.render);
console.log("[HTP Router v11] 7 nav screens. BlockDAG is the referee.");

})();
