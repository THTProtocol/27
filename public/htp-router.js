// HTP Router v14 — Complete IIFE
// 7 nav screens + 6 supporting screens. BlockDAG is the referee.
(function() {

var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
var root = null;
var timers = {};

function getRoot() { return root || (root = document.getElementById("htp-root")); }

async function api(path, opts) {
  try { var r = await fetch(B + path, Object.assign({ signal: AbortSignal.timeout(8000) }, opts || {})); return await r.json(); }
  catch(e) { return null; }
}

function kas(s)   { return s ? (Number(s)/1e8).toFixed(2)+" KAS" : "0.00 KAS"; }
function addr(a)  { return a ? (a||"").slice(0,9)+"\u2026"+(a||"").slice(-6) : "\u2014"; }
function fmtDate(ts) { return ts ? new Date(ts*1000).toLocaleDateString() : "\u2014"; }

function badge(s) {
  var cls = { open:"open", active:"active", pending:"active", settled:"settled", disputed:"disputed", matched:"active", cancelled:"settled", capped:"settled", reached:"active" };
  return "<span class=\"htp-badge htp-badge-" + (cls[(s||"").toLowerCase()]||"settled") + "\">" + (s||"?").toUpperCase() + "</span>";
}

function page(title, sub, html) {
  return "<div class=\"htp-page\"><h1 class=\"htp-page-title\">"+title+"</h1>"+(sub?"<p class=\"htp-page-subtitle\">"+sub+"</p>":"")+html+"</div>";
}

function statStrip(pairs) {
  return "<div class=\"htp-grid\" style=\"margin-bottom:20px\">" + pairs.map(function(p){ return "<div class=\"htp-card\"><div class=\"htp-stat-label\">"+p[0]+"</div><div class=\"htp-stat-val\">"+p[1]+"</div>"+(p[2]?"<div style=\"font-size:.7rem;color:var(--htp-muted)\">"+p[2]+"</div>":"")+"</div>"; }).join("") + "</div>";
}

function tabBar(id, labels, active) {
  return "<div class=\"htp-tab-bar\" id=\"tb-"+id+"\">" + labels.map(function(l,i){ return "<button class=\"htp-tab"+(i===active?" htp-tab-act":"")+"\" onclick=\"htpSwitchTab('"+id+"',"+i+")\">"+l+"</button>"; }).join("") + "</div>";
}
function tabPanels(id, htmlArr) {
  return "<div id=\"tp-"+id+"\">" + htmlArr.map(function(h,i){ return "<div class=\"htp-panel\" style=\"display:"+(i===0?"block":"none")+"\">"+h+"</div>"; }).join("") + "</div>";
}
window.htpSwitchTab = function(id, idx) {
  var bar = document.getElementById("tb-"+id); var pnl = document.getElementById("tp-"+id);
  if(!bar||!pnl) return;
  bar.querySelectorAll(".htp-tab").forEach(function(t,i){ t.className = "htp-tab"+(i===idx?" htp-tab-act":""); });
  pnl.querySelectorAll(".htp-panel").forEach(function(p,i){ p.style.display = i===idx?"block":"none"; });
};

function emptyState(msg) { return "<div style=\"text-align:center;padding:40px 0\"><p style=\"color:var(--htp-muted);margin-bottom:12px\">"+msg+"</p></div>"; }
function navigate(hash) { window.location.hash = hash; }
window.navigate = navigate;

// ═══ SCREEN: Overview (hero + live stats) ═══
window.screenOverview = async function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("HIGH TABLE PROTOCOL", "Trustless skill games and information markets on the Kaspa BlockDAG.",
    "<p style=\"text-align:center;color:var(--htp-muted);margin-bottom:24px\">The BlockDAG is the referee. Non-custodial · Covenant-enforced · Oracle-resolved · Built in Rust.</p>" +
    "<div id=\"ov-stats\"></div>" +
    "<div class=\"htp-grid\" style=\"margin-bottom:20px\">" +
    "<div class=\"htp-card\" style=\"cursor:pointer\" onclick=\"navigate('#/create')\"><h3>♟ Skill Games</h3><p style=\"color:var(--htp-muted)\">Covenant-enforced matches. Create, join, settle on the DAG.</p></div>" +
    "<div class=\"htp-card\" style=\"cursor:pointer\" onclick=\"navigate('#/oracle')\"><h3>◉ Oracle Network</h3><p style=\"color:var(--htp-muted)\">m-of-n bonded oracles. Slashable. Trustless.</p></div>" +
    "<div class=\"htp-card\" style=\"cursor:pointer\" onclick=\"navigate('#/events')\"><h3>◈ Events</h3><p style=\"color:var(--htp-muted)\">Prediction markets and information resolution.</p></div>" +
    "<div class=\"htp-card\" style=\"cursor:pointer\" onclick=\"navigate('#/games')\"><h3>⇄ Games</h3><p style=\"color:var(--htp-muted)\">Browse live and historical matches.</p></div></div>" +
    "<h2 class=\"htp-section-title\">Recent Activity</h2><div id=\"ov-recent\"><p style=\"color:var(--htp-muted)\">Loading...</p></div>");
  try {
    var s = await api("/api/stats"); var g = await api("/api/games?limit=5");
    var games = g ? (Array.isArray(g.games)?g.games:[]) : [];
    document.getElementById("ov-stats").innerHTML = statStrip([
      ["Total Games", s?s.total_games||0:0], ["Active Players", s?s.active_players||0:0],
      ["Volume (KAS)", ((s?s.total_volume_sompi||0:0)/1e8).toFixed(2)], ["Active Oracles", s?s.active_oracles||0:0]]);
    var el = document.getElementById("ov-recent");
    if(el) el.innerHTML = games.length ? "<table class=\"htp-table\"><thead><tr><th>Type</th><th>Player A</th><th>Player B</th><th>Wager</th><th>Status</th></tr></thead><tbody>" + games.map(function(gm){ return "<tr onclick=\"navigate('#/game/"+gm.id+"')\" style=\"cursor:pointer\"><td>"+(gm.game_type||"?")+"</td><td>"+addr(gm.creator)+"</td><td>"+addr(gm.opponent)+"</td><td>"+kas(gm.stake_sompi)+"</td><td>"+badge(gm.status)+"</td></tr>"; }).join("") + "</tbody></table>" : emptyState("No recent games.");
  } catch(e) { console.warn("screenOverview:", e); }
};

// ═══ SCREEN: Games ═══
window.screenGames = async function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("GAMES", "Skill-based games settled on the Kaspa BlockDAG. The DAG enforces every outcome.",
    "<div class=\"htp-tab-bar\" id=\"gm-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpGmFilter(this,'all')\">All</button><button class=\"htp-tab\" onclick=\"htpGmFilter(this,'open')\">Open</button><button class=\"htp-tab\" onclick=\"htpGmFilter(this,'active')\">Active</button><button class=\"htp-tab\" onclick=\"htpGmFilter(this,'settled')\">Settled</button></div><div id=\"gm-list\"><p style=\"color:var(--htp-muted)\">Loading...</p></div>");
  var games = []; try { var r = await fetch(B+"/api/games?limit=50"); var d = await r.json(); games = Array.isArray(d)?d:(d.games||[]); } catch(e){}
  window._htpGames = games;
  function render(filter) {
    var list = filter==="all"?games:games.filter(function(g){return(g.status||"").toLowerCase()===filter;});
    var el = document.getElementById("gm-list"); if(!el) return;
    if(!list.length){ el.innerHTML = emptyState("No "+filter+" games. <button class=\"htp-btn\" onclick=\"navigate('#/create')\">Create one</button>"); return; }
    el.innerHTML = "<div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>ID</th><th>Type</th><th>Creator</th><th>Opponent</th><th>Stake</th><th>Status</th><th></th></tr></thead><tbody>"+list.map(function(g){var s=(g.status||"open").toLowerCase();return"<tr><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(g.id||"").slice(0,10)+"\u2026</td><td style=\"font-weight:600\">"+(g.game_type||g.type||"SkillGame")+"</td><td style=\"font-family:monospace;font-size:.78rem\">"+(g.creator||"\u2014").slice(0,9)+"\u2026</td><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(g.opponent||g.matcher||"\u2014").toString().slice(0,9)+(g.opponent||g.matcher?"\u2026":"")+"</td><td style=\"font-weight:700;color:#fff\">"+((g.stake_sompi||0)/1e8).toFixed(2)+" KAS</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td><td><button class=\"htp-btn htp-btn-sm\" onclick=\"navigate('#/game/"+(g.id||"")+"')\">View</button></td></tr>";}).join("")+"</tbody></table></div>";
  }
  window.htpGmFilter = function(btn, f) { document.querySelectorAll("#gm-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");}); btn.classList.add("htp-tab-act"); render(f); };
  render("all");
};

// ═══ SCREEN: Events ═══
window.screenEvents = async function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("EVENTS", "Prediction markets on Kaspa — oracle-resolved, covenant-enforced, settled on the BlockDAG.",
    "<div class=\"htp-tab-bar\" id=\"ev-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpEvSwitch(this,'browse')\">Browse</button><button class=\"htp-tab\" onclick=\"htpEvSwitch(this,'create')\">+ Create</button></div><div id=\"ev-content\"><p style=\"color:var(--htp-muted)\">Loading...</p></div>");
  async function browse(el) {
    el.innerHTML = "<p style=\"color:var(--htp-muted)\">Loading events...</p>";
    try { var r=await fetch(B+"/api/events");var d=await r.json();var evs=Array.isArray(d)?d:(d.events||[]);
      if(!evs.length){el.innerHTML=emptyState("No events yet. Click \"+ Create\" to deploy the first market.");return;}
      el.innerHTML="<div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>ID</th><th>Title</th><th>Status</th><th></th></tr></thead><tbody>"+evs.map(function(ev){var s=(ev.status||"open").toLowerCase();return"<tr><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(ev.id||"").slice(0,10)+"\u2026</td><td>"+(ev.title||ev.description||ev.id||"Event")+"</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td><td><button class=\"htp-btn htp-btn-sm\" onclick=\"navigate('#/game/"+(ev.id||"")+"')\">View</button></td></tr>";}).join("")+"</tbody></table></div>";
    }catch(e){el.innerHTML="<p style=\"color:#ff4444\">Failed to load events.</p>";}
  }
  function showCreate(el) {
    el.innerHTML="<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px;font-size:1.1rem\">Create Prediction Market</h2><div class=\"htp-form-group\"><label>Market Title</label><input id=\"ev-title\" class=\"htp-input\" placeholder=\"Will KAS exceed $1 by Dec 2026?\" /></div><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"ev-oracle\" class=\"htp-input\" placeholder=\"kaspa:oracle...\" /></div><div class=\"htp-form-group\"><label>Stake (KAS)</label><input id=\"ev-stake\" class=\"htp-input\" type=\"number\" placeholder=\"1.00\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Resolution Date</label><input id=\"ev-date\" class=\"htp-input\" type=\"date\" /></div><button class=\"htp-btn\" onclick=\"htpCreateEvent()\">Deploy on BlockDAG</button><div id=\"ev-result\" style=\"margin-top:14px\"></div></div>";
    window.htpCreateEvent=async function(){
      var title=((document.getElementById("ev-title")||{}).value||"").trim();
      var oracle=((document.getElementById("ev-oracle")||{}).value||"").trim();
      var stake=parseFloat((document.getElementById("ev-stake")||{}).value||"0");
      var date=(document.getElementById("ev-date")||{}).value||"";var res=document.getElementById("ev-result");
      if(!title||!oracle||stake<=0){res.innerHTML="<p style=\"color:#ff4444\">Fill all fields.</p>";return;}
      var ts=date?Math.floor(new Date(date).getTime()/1000):Math.floor(Date.now()/1000)+86400*30;
      res.innerHTML="<p style=\"color:var(--htp-muted)\">Submitting...</p>";
      try{var r2=await fetch(B+"/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,oracle_address:oracle,stake_sompi:Math.round(stake*1e8),resolution_ts:ts})});var d2=await r2.json(); if(d2.id)res.innerHTML="<p style=\"color:#fff\">✓ Market: "+d2.id.slice(0,12)+"\u2026</p>";else res.innerHTML="<p style=\"color:#ff4444\">"+(d2.error||JSON.stringify(d2))+"</p>";}catch(e2){res.innerHTML="<p style=\"color:#ff4444\">Failed.</p>";}
    };
  }
  window.htpEvSwitch=function(btn,tab){document.querySelectorAll("#ev-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});btn.classList.add("htp-tab-act");var el=document.getElementById("ev-content");if(tab==="browse")browse(el);else showCreate(el);};
  browse(document.getElementById("ev-content"));
};

// ═══ SCREEN: Create ═══
window.screenCreate = async function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("CREATE", "Deploy a game or market. Covenant-enforced by Kaspa — no custodian.",
    "<div class=\"htp-tab-bar\" id=\"cr-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpCrSwitch(this,'skill')\">Skill Game</button><button class=\"htp-tab\" onclick=\"htpCrSwitch(this,'pool')\">Pool Market</button><button class=\"htp-tab\" onclick=\"htpCrSwitch(this,'tourn')\">Tournament</button></div><div id=\"cr-content\"></div>");
  var forms = {
    skill: "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px\">1v1 Skill Game</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Winner takes all via covenant settlement.</p><div class=\"htp-form-group\"><label>Game Type</label><select id=\"cr-gtype\" class=\"htp-input\"><option value=\"chess\">Chess</option><option value=\"poker\">Poker</option><option value=\"custom\">Custom</option></select></div><div class=\"htp-form-group\"><label>Your Address</label><input id=\"cr-addr\" class=\"htp-input\" placeholder=\"kaspa:q...\" /></div><div class=\"htp-form-group\"><label>Stake (KAS)</label><input id=\"cr-stake\" class=\"htp-input\" type=\"number\" placeholder=\"1.00\" min=\"0.01\" /></div><button class=\"htp-btn\" onclick=\"htpDeployGame()\">Deploy on BlockDAG</button><div id=\"cr-result\" style=\"margin-top:14px\"></div></div>",
    pool: "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px\">Pool Market</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Multi-participant. Winners share pool proportionally.</p><div class=\"htp-form-group\"><label>Market Title</label><input id=\"cr-ptitle\" class=\"htp-input\" placeholder=\"Title\" /></div><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"cr-poracle\" class=\"htp-input\" placeholder=\"kaspa:oracle...\" /></div><div class=\"htp-form-group\"><label>Min Entry (KAS)</label><input id=\"cr-pstake\" class=\"htp-input\" type=\"number\" placeholder=\"0.50\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Resolution Date</label><input id=\"cr-pdate\" class=\"htp-input\" type=\"date\" /></div><button class=\"htp-btn\" onclick=\"htpDeployPool()\">Deploy Pool</button><div id=\"cr-result\" style=\"margin-top:14px\"></div></div>",
    tourn: "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px\">Tournament</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Single-elimination bracket.</p><div class=\"htp-form-group\"><label>Game Type</label><select id=\"cr-ttype\" class=\"htp-input\"><option value=\"chess\">Chess</option><option value=\"poker\">Poker</option></select></div><div class=\"htp-form-group\"><label>Max Players</label><select id=\"cr-tplayers\" class=\"htp-input\"><option value=\"4\">4</option><option value=\"8\" selected>8</option><option value=\"16\">16</option></select></div><div class=\"htp-form-group\"><label>Entry Stake (KAS)</label><input id=\"cr-tstake\" class=\"htp-input\" type=\"number\" placeholder=\"2.00\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Your Address</label><input id=\"cr-taddr\" class=\"htp-input\" placeholder=\"kaspa:q...\" /></div><button class=\"htp-btn\" onclick=\"htpDeployTourn()\">Deploy</button><div id=\"cr-result\" style=\"margin-top:14px\"></div></div>"
  };
  window.htpCrSwitch = function(btn, tab) { document.querySelectorAll("#cr-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");}); btn.classList.add("htp-tab-act"); document.getElementById("cr-content").innerHTML = forms[tab]; };
  function setRes(html) { var e = document.getElementById("cr-result"); if(e) e.innerHTML = html; }
  window.htpDeployGame = async function() {
    var type = (document.getElementById("cr-gtype")||{}).value||"chess"; var addr = ((document.getElementById("cr-addr")||{}).value||"").trim(); var stake = parseFloat((document.getElementById("cr-stake")||{}).value||"0");
    if(!addr||stake<=0){setRes("<p style=\"color:#ff4444\">Address and stake required.</p>");return;}
    setRes("<p style=\"color:var(--htp-muted)\">Creating...</p>");
    try{var r2=await fetch(B+"/api/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creator:addr,game_type:type,stake_sompi:Math.round(stake*1e8)})});var d=await r2.json();if(d.id)setRes("<p style=\"color:#fff\">✓ Game: <a href=\"#/game/"+d.id+"\">"+d.id.slice(0,14)+"\u2026</a></p>");else setRes("<p style=\"color:#ff4444\">Error: "+(d.error||JSON.stringify(d))+"</p>");}catch(e){setRes("<p style=\"color:#ff4444\">Failed.</p>");}
  };
  window.htpDeployPool = async function() {
    var title=((document.getElementById("cr-ptitle")||{}).value||"").trim(); var oracle=((document.getElementById("cr-poracle")||{}).value||"").trim(); var stake=parseFloat((document.getElementById("cr-pstake")||{}).value||"0"); var date=(document.getElementById("cr-pdate")||{}).value||"";
    if(!title||!oracle||stake<=0){setRes("<p style=\"color:#ff4444\">All fields required.</p>");return;}
    var ts=date?Math.floor(new Date(date).getTime()/1000):Math.floor(Date.now()/1000)+86400*30;
    setRes("<p style=\"color:var(--htp-muted)\">Deploying...</p>");
    try{var r2=await fetch(B+"/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,oracle_address:oracle,stake_sompi:Math.round(stake*1e8),resolution_ts:ts})});var d=await r2.json();if(d.id)setRes("<p style=\"color:#fff\">✓ Pool: "+d.id.slice(0,12)+"\u2026</p>");else setRes("<p style=\"color:#ff4444\">"+(d.error||JSON.stringify(d))+"</p>");}catch(e){setRes("<p style=\"color:#ff4444\">Failed.</p>");}
  };
  window.htpDeployTourn = async function() {
    var type=(document.getElementById("cr-ttype")||{}).value||"chess"; var players=parseInt((document.getElementById("cr-tplayers")||{}).value||"8"); var stake=parseFloat((document.getElementById("cr-tstake")||{}).value||"0"); var addr=((document.getElementById("cr-taddr")||{}).value||"").trim();
    if(!addr||stake<=0){setRes("<p style=\"color:#ff4444\">Address and stake required.</p>");return;}
    setRes("<p style=\"color:var(--htp-muted)\">Deploying...</p>");
    try{var r2=await fetch(B+"/api/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creator:addr,game_type:"tourn-"+type,max_players:players,stake_sompi:Math.round(stake*1e8)})});var d=await r2.json();if(d.id)setRes("<p style=\"color:#fff\">✓ Tournament: "+d.id.slice(0,12)+"\u2026</p>");else setRes("<p style=\"color:#ff4444\">"+(d.error||JSON.stringify(d))+"</p>");}catch(e){setRes("<p style=\"color:#ff4444\">Failed.</p>");}
  };
  document.getElementById("cr-content").innerHTML = forms.skill;
};

// ═══ SCREEN: Portfolio ═══
window.screenPortfolio = async function() {
  var R = getRoot(); if(!R) return;
  var stored = window._htpWalletAddress || window.connectedAddress || "";
  R.innerHTML = page("PORTFOLIO", "Your positions on the Kaspa BlockDAG.",
    "<div style=\"display:flex;gap:10px;margin-bottom:24px;align-items:center\"><input id=\"pf-addr\" class=\"htp-input\" placeholder=\"kaspa:your-address...\" value=\""+stored+"\" style=\"flex:1;max-width:480px\" /><button class=\"htp-btn\" onclick=\"htpLoadPF()\">Load</button></div><div id=\"pf-content\"></div>");
  window.htpLoadPF = async function() {
    var addr = ((document.getElementById("pf-addr")||{}).value||"").trim(); var el = document.getElementById("pf-content"); if(!el) return;
    if(!addr){el.innerHTML="<p style=\"color:#ff4444\">Enter a Kaspa address.</p>";return;}
    el.innerHTML = "<p style=\"color:var(--htp-muted)\">Loading...</p>";
    try { var r=await fetch(B+"/api/portfolio/"+encodeURIComponent(addr)); var d=await r.json();
      if(d.error){el.innerHTML="<p style=\"color:#ff4444\">"+d.error+"</p>";return;}
      var games=d.games||[]; var tw=d.total_wagered_sompi||0; var twn=d.total_won_sompi||0; var wins=d.win_count||0; var losses=d.loss_count||0; var wr=(wins+losses)>0?Math.round(wins/(wins+losses)*100)+"%":"\u2014";
      el.innerHTML=statStrip([["Wagered",kas(tw)],["Won",kas(twn)],["Win Rate",wr],["Games",games.length]])+(games.length?"<h2 class=\"htp-section-title\">Games</h2><div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>ID</th><th>Type</th><th>Stake</th><th>Status</th><th></th></tr></thead><tbody>"+games.map(function(g){var s=(g.status||"open").toLowerCase();return"<tr><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(g.id||"").slice(0,10)+"\u2026</td><td>"+(g.game_type||"\u2014")+"</td><td style=\"font-weight:700;color:#fff\">"+((g.stake_sompi||0)/1e8).toFixed(2)+" KAS</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td><td><button class=\"htp-btn htp-btn-sm\" onclick=\"navigate('#/game/"+(g.id||"")+"')\">View</button></td></tr>";}).join("")+"</tbody></table></div>":"<p style=\"color:var(--htp-muted)\">No games.</p>");
    }catch(e){el.innerHTML="<p style=\"color:#ff4444\">Request failed.</p>";}
  };
  if(stored) { document.getElementById("pf-addr").value = stored; window.htpLoadPF(); }
};

// ═══ SCREEN: Oracle ═══
window.screenOracle = async function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("ORACLE NETWORK", "Bonded oracle nodes resolving outcomes on the Kaspa BlockDAG.",
    "<div class=\"htp-tab-bar\" id=\"or-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpOrSwitch(this,'dashboard')\">Dashboard</button><button class=\"htp-tab\" onclick=\"htpOrSwitch(this,'register')\">Register</button><button class=\"htp-tab\" onclick=\"htpOrSwitch(this,'attest')\">Attest</button></div><div id=\"or-content\"><p style=\"color:var(--htp-muted)\">Loading...</p></div>");
  async function dash(el) {
    el.innerHTML = "<p style=\"color:var(--htp-muted)\">Fetching...</p>";
    try{var r=await fetch(B+"/api/oracle/network");var d=await r.json();var oracles=d.oracles||d.nodes||[];var active=d.active_oracles||d.active||oracles.filter(function(o){return o.status==="active";}).length;var total=d.total_oracles||d.total||oracles.length;var quorum=d.quorum||d.min_quorum||Math.ceil(total/2)+1;
      el.innerHTML=statStrip([["Active",active],["Total",total],["Quorum",quorum],["Status",""+(active>=quorum?"LIVE":"DEGRADED")]])+(oracles.length?"<h2 class=\"htp-section-title\">Nodes</h2><div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>Address</th><th>Bond</th><th>Slashes</th><th>Status</th></tr></thead><tbody>"+oracles.map(function(o){var s=(o.status||"active").toLowerCase();return"<tr><td style=\"font-family:monospace;font-size:.78rem\">"+(o.address||"").slice(0,14)+"\u2026</td><td style=\"font-weight:700;color:#fff\">"+((o.bond_sompi||0)/1e8).toFixed(2)+" KAS</td><td>"+(o.slash_count||0)+"</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td></tr>";}).join("")+"</tbody></table></div>":"<p style=\"color:var(--htp-muted)\">No oracles.</p>");
    }catch(e){el.innerHTML="<p style=\"color:#ff4444\">Failed.</p>";}
  }
  function reg(el) {
    el.innerHTML="<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px\">Register Node</h2><div class=\"htp-form-group\"><label>Address</label><input id=\"or-addr\" class=\"htp-input\" /></div><div class=\"htp-form-group\"><label>Bond (KAS)</label><input id=\"or-bond\" class=\"htp-input\" type=\"number\" value=\"100\" min=\"1\" /></div><button class=\"htp-btn\" onclick=\"htpRegOracle()\">Register</button><div id=\"or-result\" style=\"margin-top:14px\"></div></div>";
    window.htpRegOracle=async function(){var addr=((document.getElementById("or-addr")||{}).value||"").trim();var bond=parseFloat((document.getElementById("or-bond")||{}).value||"0");var res=document.getElementById("or-result");if(!addr||bond<=0){res.innerHTML="<p style=\"color:#ff4444\">Fill all fields.</p>";return;}res.innerHTML="<p style=\"color:var(--htp-muted)\">Registering...</p>";try{var r2=await fetch(B+"/api/oracle/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({oracle_address:addr,bond_sompi:Math.round(bond*1e8)})});var d=await r2.json();if(d.id||d.status==="registered")res.innerHTML="<p style=\"color:#fff\">✓ Registered.</p>";else res.innerHTML="<p style=\"color:#ff4444\">"+(d.error||JSON.stringify(d))+"</p>";}catch(e){res.innerHTML="<p style=\"color:#ff4444\">Failed.</p>";}};
  }
  function att(el) {
    el.innerHTML="<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px\">Submit Attestation</h2><div class=\"htp-form-group\"><label>Event ID</label><input id=\"or-evid\" class=\"htp-input\" /></div><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"or-oaddr\" class=\"htp-input\" /></div><div class=\"htp-form-group\"><label>Outcome</label><select id=\"or-outcome\" class=\"htp-input\"><option value=\"yes\">YES / A wins</option><option value=\"no\">NO / B wins</option><option value=\"draw\">DRAW</option></select></div><button class=\"htp-btn\" onclick=\"htpSubmitAtt()\">Submit</button><div id=\"or-result\" style=\"margin-top:14px\"></div></div>";
    window.htpSubmitAtt=async function(){var evid=((document.getElementById("or-evid")||{}).value||"").trim();var oaddr=((document.getElementById("or-oaddr")||{}).value||"").trim();var outcome=(document.getElementById("or-outcome")||{}).value||"yes";var res=document.getElementById("or-result");if(!evid||!oaddr){res.innerHTML="<p style=\"color:#ff4444\">Fill all fields.</p>";return;}res.innerHTML="<p style=\"color:var(--htp-muted)\">Submitting...</p>";try{var r2=await fetch(B+"/api/oracle/attest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_id:evid,oracle_address:oaddr,outcome:outcome})});var d=await r2.json();if(d.id||d.status)res.innerHTML="<p style=\"color:#fff\">✓ Attested.</p>";else res.innerHTML="<p style=\"color:#ff4444\">"+(d.error||JSON.stringify(d))+"</p>";}catch(e){res.innerHTML="<p style=\"color:#ff4444\">Failed.</p>";}};
  }
  window.htpOrSwitch=function(btn,tab){document.querySelectorAll("#or-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});btn.classList.add("htp-tab-act");var el=document.getElementById("or-content");if(tab==="dashboard")dash(el);else if(tab==="register")reg(el);else att(el);};
  dash(document.getElementById("or-content"));
};

// ═══ SCREEN: Wallet ═══
window.screenWallet = function() {
  var R = getRoot(); if(!R) return;
  var stored = window._htpWalletAddress || window.connectedAddress || "";
  function showConnect() {
    R.innerHTML = page("WALLET", "Connect your Kaspa wallet.",
      "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px\">Connect</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Enter your Kaspa address. Non-custodial.</p><div class=\"htp-form-group\"><label>Address</label><input id=\"wlt-addr\" class=\"htp-input\" placeholder=\"kaspa:q...\" value=\""+stored+"\" /></div><button class=\"htp-btn\" onclick=\"htpConnectWallet()\">Connect</button></div>");
  }
  async function showDash(addr) {
    R.innerHTML = page("WALLET", "Connected: <span style=\"font-family:monospace;font-size:.85rem\">"+addr+"</span>", "<div id=\"wc-load\"><p style=\"color:var(--htp-muted)\">Loading balance...</p></div>");
    try { var r=await fetch(B+"/api/balance/"+encodeURIComponent(addr)); var d=await r.json(); if(d.error)throw new Error(d.error);
      document.getElementById("wc-load").innerHTML =
        statStrip([["Balance",((d.balance_sompi||d.balance||0)/1e8).toFixed(4)+" KAS"]]) +
        "<div style=\"display:flex;gap:10px;flex-wrap:wrap\"><button class=\"htp-btn\" onclick=\"navigate('#/portfolio')\">Portfolio</button><button class=\"htp-btn\" onclick=\"navigate('#/create')\">Create</button><button class=\"htp-btn\" onclick=\"navigate('#/games')\">Games</button><button class=\"htp-btn\" style=\"background:rgba(255,68,68,0.1);border:1px solid #ff4444;color:#ff4444\" onclick=\"htpDiscWallet()\">Disconnect</button></div>";
    }catch(e){document.getElementById("wc-load").innerHTML="<p style=\"color:#ff4444\">Failed: "+e.message+"</p>";}
  }
  window.htpConnectWallet = async function() {
    var addr = ((document.getElementById("wlt-addr")||{}).value||"").trim();
    if(!addr.startsWith("kaspa:")){R.innerHTML+="<p style=\"color:#ff4444\">Must start with kaspa:</p>";return;}
    window._htpWalletAddress = addr; window.connectedAddress = addr; try{localStorage.setItem("htp_wallet_addr",addr);}catch(e){} await showDash(addr);
  };
  window.htpDiscWallet = function() { window._htpWalletAddress = null; window.connectedAddress = null; try{localStorage.removeItem("htp_wallet_addr");}catch(e){} showConnect(); };
  if (stored && typeof stored === "string" && stored.startsWith("kaspa:")) showDash(stored); else showConnect();
};

// ═══ SCREEN: Game Detail ═══
window.screenGame = async function(id) {
  var R = getRoot(); if(!R||!id){R&&(R.innerHTML=emptyState("No game ID"));return;}
  var g = await api("/api/games/"+id);
  if(!g||g.error){R.innerHTML=emptyState("Game not found: "+id);return;}
  R.innerHTML = page("GAME: "+id.slice(-8), "Match details and settlement status.",
    "<div class=\"htp-card\" style=\"padding:16px;margin-bottom:16px\"><p>Type: "+(g.game_type||"?")+"</p><p>Creator: "+addr(g.creator)+"</p><p>Opponent: "+addr(g.opponent)+"</p><p>Wager: "+kas(g.stake_sompi)+"</p><p>Status: "+badge(g.status)+"</p>"+(g.winner?"<p>Winner: <span style=\"color:#fff\">"+addr(g.winner)+"</span></p>":"")+"</div>"+(g.status==="open"?"<button class=\"htp-btn\" onclick=\"var a=prompt('Your address?'); if(a)fetch(B+'/api/games/"+id+"/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:a})}).then(function(){navigate('#/game/"+id+"');});\">Join Match</button>":"")+" <a href=\"#/settle/"+id+"\" class=\"htp-btn\">Settle →</a>");
  if(timers["g_"+id])clearInterval(timers["g_"+id]); timers["g_"+id]=setInterval(function(){window.screenGame(id);},5000);
};

// ═══ SCREEN: Settle ═══
window.screenSettle = async function(id) {
  var R = getRoot(); if(!R||!id){R&&(R.innerHTML=emptyState("No game ID"));return;}
  R.innerHTML = page("SETTLE", "",
    "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\"><p>Game: <strong>"+id+"</strong></p><input id=\"st-winner\" class=\"htp-input\" placeholder=\"Winner Address\" style=\"width:100%;margin-bottom:8px\"><button class=\"htp-btn\" onclick=\"var w=document.getElementById('st-winner').value;if(w)fetch(B+'/api/games/"+id+"/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winner:w})}).then(function(r){return r.json();}).then(function(d){document.getElementById('st-result').textContent=JSON.stringify(d,null,2);});\">Propose Settlement</button><pre id=\"st-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px;font-size:.8rem\"></pre></div>");
};

// ═══ SCREEN: Dispute ═══
window.screenDispute = async function(id) {
  var R = getRoot(); if(!R||!id){R&&(R.innerHTML=emptyState("No game ID"));return;}
  R.innerHTML = page("DISPUTE", "",
    "<div class=\"htp-card\" style=\"max-width:480px;padding:16px\"><p>Game: <strong>"+id+"</strong></p><input id=\"dp-addr\" class=\"htp-input\" placeholder=\"Your Address\" style=\"width:100%;margin-bottom:8px\"><button class=\"htp-btn\" style=\"background:rgba(255,80,80,0.15);border-color:rgba(255,80,80,0.3);color:#f66\" onclick=\"var a=document.getElementById('dp-addr').value;if(a)fetch(B+'/api/games/"+id+"/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenger:a})}).then(function(r){return r.json();}).then(function(d){document.getElementById('dp-result').textContent=JSON.stringify(d,null,2);});\">Challenge</button><pre id=\"dp-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px\"></pre></div>");
};

// ═══ SCREEN: Admin ═══
window.screenAdmin = function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("ADMIN", "",
    "<div class=\"htp-form-card\"><div class=\"htp-form-group\"><label>Admin Key</label><input id=\"admin-key\" class=\"htp-input\" type=\"password\" /></div><button class=\"htp-btn\" onclick=\"var k=document.getElementById('admin-key').value;if(k)fetch(B+'/api/admin/stats',{headers:{'x-admin-key':k}}).then(function(r){return r.json();}).then(function(d){document.getElementById('admin-result').textContent=JSON.stringify(d,null,2);});\">View Stats</button><pre id=\"admin-result\" style=\"margin-top:12px;background:var(--htp-bg);padding:12px;border-radius:4px;font-size:.8rem;overflow-x:auto\"></pre></div>");
};

// ═══ SCREEN: Docs ═══
window.screenDocs = function() {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("DOCS", "Architecture and on-DAG infrastructure.",
    "<div class=\"htp-card\" style=\"padding:16px;margin-bottom:12px\"><h3>Stack</h3><table class=\"htp-table\"><tbody><tr><td>Backend</td><td>Rust (axum + sqlx + sqlite) — ≥80% of codebase</td></tr><tr><td>Frontend</td><td>Vanilla JS, no framework, no build step</td></tr><tr><td>Network</td><td>Kaspa TN12 → Mainnet</td></tr><tr><td>Oracles</td><td>m-of-n bonded, slashable, on-DAG</td></tr><tr><td>Settler</td><td>Rust auto-settler, every 30s</td></tr><tr><td>Consensus</td><td>GHOSTDAG, 10 BPS, sub-second inclusion</td></tr></tbody></table></div>"+
    "<div class=\"htp-card\" style=\"padding:16px\"><h3>Covenants</h3><table class=\"htp-table\"><thead><tr><th>Type</th><th>Status</th></tr></thead><tbody><tr><td>SkillGame escrow</td><td>"+badge("active")+"</td></tr><tr><td>Oracle bond</td><td>"+badge("active")+"</td></tr><tr><td>Toccata mainnet</td><td>"+badge("pending")+"</td></tr></tbody></table></div>");
};

// ═══ SCREEN: Transaction ═══
window.screenTx = function(id) {
  var R = getRoot(); if(!R) return;
  R.innerHTML = page("TX", "",
    "<div class=\"htp-card\" style=\"padding:16px;text-align:center\"><p>Transaction: <strong>"+(id||"?")+"</strong></p><a class=\"htp-btn\" target=\"_blank\" href=\"https://explorer-tn12.kaspa.org/txs/"+(id||"")+"\">View Explorer →</a></div>");
};

// ═══ RENDER ENGINE ═══
window.htpRouter = { render: function() {
  root = document.getElementById("htp-root");
  if(!root) return;

  // Hide legacy sections
  var legacy = document.querySelectorAll("section.view, main.shell-main, .shell-main");
  for(var i=0;i<legacy.length;i++) legacy[i].style.display = "none";

  var hash = (window.location.hash||"").replace(/^#\/?/,"")||"overview";
  var parts = hash.split("/"); var route = "/"+parts[0]; var id = parts[1]||null;

  Object.keys(timers).forEach(function(k){
    var keep = false;
    if(route==="/games"&&k==="games")keep=true;
    if(route==="/portfolio"&&k==="portfolio")keep=true;
    if(route==="/game"&&k==="g_"+id)keep=true;
    if(!keep){clearInterval(timers[k]);delete timers[k];}
  });

  var navMap = {"overview":"overview","events":"events","create":"create","games":"games","game":"games","oracle":"oracle","portfolio":"portfolio","wallet":"wallet"};
  document.querySelectorAll(".nav-btn[data-v]").forEach(function(b){b.classList.toggle("act",b.getAttribute("data-v")===(navMap[parts[0]]||"overview"));});

  switch(route) {
    case "/overview":if(window.screenOverview)window.screenOverview();break;
    case "/events":if(window.screenEvents)window.screenEvents();break;
    case "/create":if(window.screenCreate)window.screenCreate();break;
    case "/games":if(window.screenGames)window.screenGames();break;
    case "/game":if(window.screenGame)window.screenGame(id);break;
    case "/oracle":if(window.screenOracle)window.screenOracle();break;
    case "/portfolio":if(window.screenPortfolio)window.screenPortfolio();break;
    case "/wallet":if(window.screenWallet)window.screenWallet();break;
    case "/settle":if(window.screenSettle)window.screenSettle(id);break;
    case "/dispute":if(window.screenDispute)window.screenDispute(id);break;
    case "/admin":if(window.screenAdmin)window.screenAdmin();break;
    case "/docs":if(window.screenDocs)window.screenDocs();break;
    case "/tx":if(window.screenTx)window.screenTx(id);break;
    default:if(window.screenOverview)window.screenOverview();break;
  }
}};

window.addEventListener("load",window.htpRouter.render);
window.addEventListener("hashchange",window.htpRouter.render);
console.log("[HTP Router v14] 13 screens. BlockDAG is the referee.");

})();
