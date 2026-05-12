window.screenGames = async function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Games</h1><p class=\"htp-page-subtitle\">Skill-based games settled on the Kaspa BlockDAG. The DAG enforces every outcome.</p><div class=\"htp-tab-bar\" id=\"gm-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpFilter(this,'all')\">All</button><button class=\"htp-tab\" onclick=\"htpFilter(this,'open')\">Open</button><button class=\"htp-tab\" onclick=\"htpFilter(this,'active')\">Active</button><button class=\"htp-tab\" onclick=\"htpFilter(this,'settled')\">Settled</button></div><div id=\"gm-list\"><p style=\"color:var(--htp-muted)\">Loading...</p></div></div>";
  var games = [];
  try { var r = await fetch(B+"/api/games?limit=50"); var d = await r.json(); games = Array.isArray(d)?d:(d.games||[]); } catch(e){}
  window._htpGames = games;
  function render(filter) {
    var list = filter==="all"?games:games.filter(function(g){return(g.status||"").toLowerCase()===filter;});
    var el = document.getElementById("gm-list"); if(!el) return;
    if(!list.length){ el.innerHTML = "<p style=\"color:var(--htp-muted);padding:20px 0\">No "+filter+" games. <button class=\"htp-btn\" onclick=\"window.location.hash='#/create'\">Create one</button></p>"; return; }
    el.innerHTML = "<div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>ID</th><th>Type</th><th>Creator</th><th>Opponent</th><th>Stake</th><th>Status</th><th></th></tr></thead><tbody>"+list.map(function(g){var s=(g.status||"open").toLowerCase(); return "<tr><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(g.id||"").slice(0,10)+"…</td><td style=\"font-weight:600\">"+(g.game_type||g.type||"SkillGame")+"</td><td style=\"font-family:monospace;font-size:.78rem\">"+(g.creator||"—").slice(0,9)+"…</td><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(g.opponent||g.matcher||"—").toString().slice(0,9)+(g.opponent||g.matcher?"…":"")+"</td><td style=\"font-weight:700;color:var(--htp-gold)\">"+((g.stake_sompi||0)/1e8).toFixed(2)+" KAS</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td><td><button class=\"htp-btn htp-btn-sm\" onclick=\"window.location.hash='#/game/"+(g.id||"")+"'\">View</button></td></tr>";}).join("")+"</tbody></table></div>";
  }
  window.htpFilter = function(btn, f) {
    document.querySelectorAll("#gm-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});
    btn.classList.add("htp-tab-act"); render(f);
  };
  render("all");
};
window.screenEvents = async function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Events</h1><p class=\"htp-page-subtitle\">Prediction markets on Kaspa — oracle-resolved, covenant-enforced, settled on the BlockDAG.</p><div class=\"htp-tab-bar\" id=\"ev-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpEvSwitch(this,'browse')\">Browse</button><button class=\"htp-tab\" onclick=\"htpEvSwitch(this,'create')\">+ Create</button></div><div id=\"ev-content\"><p style=\"color:var(--htp-muted)\">Loading...</p></div></div>";
  async function browse(el) {
    el.innerHTML = "<p style=\"color:var(--htp-muted)\">Loading events...</p>";
    try {
      var r = await fetch(B+"/api/events"); var d = await r.json();
      var evs = Array.isArray(d)?d:(d.events||[]);
      if(!evs.length){el.innerHTML="<div style=\"text-align:center;padding:40px 0\"><p style=\"color:var(--htp-muted);margin-bottom:16px\">No events yet.</p><button class=\"htp-btn\" onclick=\"document.querySelectorAll('#ev-tabs .htp-tab')[1].click()\">Create the first market</button></div>";return;}
      el.innerHTML = "<div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>ID</th><th>Title</th><th>Oracle</th><th>Stake</th><th>Resolves</th><th>Status</th><th></th></tr></thead><tbody>"+evs.map(function(ev){var s=(ev.status||"open").toLowerCase(); var ts=ev.resolution_ts?new Date(ev.resolution_ts*1000).toLocaleDateString():"—"; return "<tr><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(ev.id||"").slice(0,8)+"…</td><td style=\"max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">"+(ev.title||ev.description||ev.id||"Event")+"</td><td style=\"font-family:monospace;font-size:.78rem\">"+(ev.oracle_address||ev.oracle||"—").slice(0,10)+"…</td><td style=\"font-weight:700;color:var(--htp-gold)\">"+((ev.stake_sompi||0)/1e8).toFixed(2)+" KAS</td><td style=\"color:var(--htp-muted);font-size:.85rem\">"+ts+"</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td><td><button class=\"htp-btn htp-btn-sm\" onclick=\"window.location.hash='#/events/"+(ev.id||"")+"'\">View</button></td></tr>";}).join("")+"</tbody></table></div>";
    }catch(e){el.innerHTML="<p style=\"color:#ff4444\">Failed to load events.</p>";}
  }
  function showCreate(el) {
    el.innerHTML = "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px;font-size:1.1rem\">Create Prediction Market</h2><div class=\"htp-form-group\"><label>Market Title</label><input id=\"ev-title\" class=\"htp-input\" placeholder=\"Will KAS exceed $1 by Dec 2026?\" /></div><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"ev-oracle\" class=\"htp-input\" placeholder=\"kaspa:oracle...\" /></div><div class=\"htp-form-group\"><label>Stake (KAS)</label><input id=\"ev-stake\" class=\"htp-input\" type=\"number\" placeholder=\"1.00\" step=\"0.01\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Resolution Date</label><input id=\"ev-date\" class=\"htp-input\" type=\"date\" /></div><button class=\"htp-btn\" onclick=\"htpCreateEvent()\">Deploy on BlockDAG</button><div id=\"ev-result\" style=\"margin-top:14px\"></div></div>";
    window.htpCreateEvent = async function() {
      var title = (document.getElementById("ev-title")||{}).value||"";
      var oracle = (document.getElementById("ev-oracle")||{}).value||"";
      var stake = parseFloat((document.getElementById("ev-stake")||{}).value||"0");
      var date = (document.getElementById("ev-date")||{}).value||"";
      var res = document.getElementById("ev-result");
      if(!title.trim()||!oracle.trim()||stake<=0){res.innerHTML="<p style=\"color:#ff4444\">Please fill all fields.</p>";return;}
      var ts = date?Math.floor(new Date(date).getTime()/1000):Math.floor(Date.now()/1000)+86400*30;
      res.innerHTML = "<p style=\"color:var(--htp-muted)\">Submitting to BlockDAG...</p>";
      try {
        var r2 = await fetch(B+"/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title.trim(),oracle_address:oracle.trim(),stake_sompi:Math.round(stake*1e8),resolution_ts:ts})});
        var d2 = await r2.json();
        if(d2.id) res.innerHTML="<p style=\"color:#39ff90\">✓ Market created: <a href=\"#/events/"+d2.id+"\" style=\"color:#39ff90\">"+d2.id.slice(0,12)+"…</a></p>";
        else res.innerHTML="<p style=\"color:#ff4444\">Error: "+(d2.error||JSON.stringify(d2))+"</p>";
      }catch(e2){res.innerHTML="<p style=\"color:#ff4444\">Request failed.</p>";}
    };
  }
  window.htpEvSwitch = function(btn,tab) {
    document.querySelectorAll("#ev-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});
    btn.classList.add("htp-tab-act");
    var el = document.getElementById("ev-content");
    if(tab==="browse") browse(el); else showCreate(el);
  };
  browse(document.getElementById("ev-content"));
};
window.screenCreate = async function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Create</h1><p class=\"htp-page-subtitle\">Deploy a game or market. Covenant-enforced by Kaspa — no custodian, no trusted third party.</p><div class=\"htp-tab-bar\" id=\"cr-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpCrTab(this,'skill')\">Skill Game</button><button class=\"htp-tab\" onclick=\"htpCrTab(this,'pool')\">Pool Market</button><button class=\"htp-tab\" onclick=\"htpCrTab(this,'tourn')\">Tournament</button></div><div id=\"cr-content\"></div></div>";
  var forms = {
    skill: "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px;font-size:1.1rem\">1v1 Skill Game</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Both players lock equal stakes. Winner takes all via covenant settlement on the BlockDAG.</p><div class=\"htp-form-group\"><label>Game Type</label><select id=\"cr-gtype\" class=\"htp-input\"><option value=\"chess\">Chess</option><option value=\"poker\">Poker</option><option value=\"custom\">Custom</option></select></div><div class=\"htp-form-group\"><label>Your Kaspa Address</label><input id=\"cr-addr\" class=\"htp-input\" placeholder=\"kaspa:q...\" /></div><div class=\"htp-form-group\"><label>Stake (KAS)</label><input id=\"cr-stake\" class=\"htp-input\" type=\"number\" placeholder=\"1.00\" step=\"0.01\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Oracle Address (optional)</label><input id=\"cr-goracle\" class=\"htp-input\" placeholder=\"kaspa:oracle...\" /></div><button class=\"htp-btn\" onclick=\"htpDeployGame()\">Deploy on BlockDAG</button><div id=\"cr-result\" style=\"margin-top:14px\"></div></div>",
    pool: "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px;font-size:1.1rem\">Pool Prediction Market</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Multi-participant market. Winners share pool proportionally. Resolved by bonded oracle on the BlockDAG.</p><div class=\"htp-form-group\"><label>Market Title</label><input id=\"cr-ptitle\" class=\"htp-input\" placeholder=\"Will KAS exceed $1 by Dec 2026?\" /></div><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"cr-poracle\" class=\"htp-input\" placeholder=\"kaspa:oracle...\" /></div><div class=\"htp-form-group\"><label>Min Entry Stake (KAS)</label><input id=\"cr-pstake\" class=\"htp-input\" type=\"number\" placeholder=\"0.50\" step=\"0.01\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Resolution Date</label><input id=\"cr-pdate\" class=\"htp-input\" type=\"date\" /></div><button class=\"htp-btn\" onclick=\"htpDeployPool()\">Deploy Pool on BlockDAG</button><div id=\"cr-result\" style=\"margin-top:14px\"></div></div>",
    tourn: "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px;font-size:1.1rem\">Tournament Bracket</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Single-elimination bracket. Entry stakes pool to winner. Enforced on-chain by the Kaspa BlockDAG.</p><div class=\"htp-form-group\"><label>Game Type</label><select id=\"cr-ttype\" class=\"htp-input\"><option value=\"chess\">Chess</option><option value=\"poker\">Poker</option></select></div><div class=\"htp-form-group\"><label>Max Players (power of 2)</label><select id=\"cr-tplayers\" class=\"htp-input\"><option value=\"4\">4</option><option value=\"8\" selected>8</option><option value=\"16\">16</option><option value=\"32\">32</option></select></div><div class=\"htp-form-group\"><label>Entry Stake (KAS)</label><input id=\"cr-tstake\" class=\"htp-input\" type=\"number\" placeholder=\"2.00\" step=\"0.01\" min=\"0.01\" /></div><div class=\"htp-form-group\"><label>Your Address (organizer)</label><input id=\"cr-taddr\" class=\"htp-input\" placeholder=\"kaspa:q...\" /></div><button class=\"htp-btn\" onclick=\"htpDeployTourn()\">Deploy Tournament</button><div id=\"cr-result\" style=\"margin-top:14px\"></div></div>"
  };
  window.htpCrTab = function(btn, tab) {
    document.querySelectorAll("#cr-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});
    btn.classList.add("htp-tab-act");
    document.getElementById("cr-content").innerHTML = forms[tab];
  };
  function setRes(html) { var e = document.getElementById("cr-result"); if(e) e.innerHTML = html; }
  window.htpDeployGame = async function() {
    var type = (document.getElementById("cr-gtype")||{}).value||"chess";
    var addr = ((document.getElementById("cr-addr")||{}).value||"").trim();
    var stake = parseFloat((document.getElementById("cr-stake")||{}).value||"0");
    var oracle = ((document.getElementById("cr-goracle")||{}).value||"").trim();
    if(!addr||stake<=0){setRes("<p style=\"color:#ff4444\">Address and stake required.</p>");return;}
    setRes("<p style=\"color:var(--htp-muted)\">Creating game on BlockDAG...</p>");
    try {
      var body = {creator:addr,game_type:type,stake_sompi:Math.round(stake*1e8)};
      if(oracle)body.oracle_address=oracle;
      var r2 = await fetch(B+"/api/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      var d = await r2.json();
      if(d.id)setRes("<p style=\"color:#39ff90\">✓ Game deployed: <a href=\"#/game/"+d.id+"\" style=\"color:#39ff90\">"+d.id.slice(0,14)+"…</a></p><p style=\"color:var(--htp-muted);font-size:.85rem\">Share your game ID so your opponent can join.</p>");
      else setRes("<p style=\"color:#ff4444\">Error: "+(d.error||JSON.stringify(d))+"</p>");
    }catch(e){setRes("<p style=\"color:#ff4444\">Request failed.</p>");}
  };
  window.htpDeployPool = async function() {
    var title = ((document.getElementById("cr-ptitle")||{}).value||"").trim();
    var oracle = ((document.getElementById("cr-poracle")||{}).value||"").trim();
    var stake = parseFloat((document.getElementById("cr-pstake")||{}).value||"0");
    var date = (document.getElementById("cr-pdate")||{}).value||"";
    if(!title||!oracle||stake<=0){setRes("<p style=\"color:#ff4444\">All fields required.</p>");return;}
    var ts = date?Math.floor(new Date(date).getTime()/1000):Math.floor(Date.now()/1000)+86400*30;
    setRes("<p style=\"color:var(--htp-muted)\">Deploying pool market...</p>");
    try {
      var r2 = await fetch(B+"/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,oracle_address:oracle,stake_sompi:Math.round(stake*1e8),resolution_ts:ts})});
      var d = await r2.json();
      if(d.id)setRes("<p style=\"color:#39ff90\">✓ Pool deployed: "+d.id.slice(0,12)+"…</p>");
      else setRes("<p style=\"color:#ff4444\">Error: "+(d.error||JSON.stringify(d))+"</p>");
    }catch(e){setRes("<p style=\"color:#ff4444\">Request failed.</p>");}
  };
  window.htpDeployTourn = async function() {
    var type = (document.getElementById("cr-ttype")||{}).value||"chess";
    var players = parseInt((document.getElementById("cr-tplayers")||{}).value||"8");
    var stake = parseFloat((document.getElementById("cr-tstake")||{}).value||"0");
    var addr = ((document.getElementById("cr-taddr")||{}).value||"").trim();
    if(!addr||stake<=0){setRes("<p style=\"color:#ff4444\">Address and stake required.</p>");return;}
    setRes("<p style=\"color:var(--htp-muted)\">Deploying tournament...</p>");
    try {
      var r2 = await fetch(B+"/api/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creator:addr,game_type:"tourn-"+type,order_type:"tournament",max_players:players,stake_sompi:Math.round(stake*1e8)})});
      var d = await r2.json();
      if(d.id)setRes("<p style=\"color:#39ff90\">✓ Tournament deployed: "+d.id.slice(0,12)+"…</p><p style=\"color:var(--htp-muted);font-size:.85rem\">Share ID for players to join.</p>");
      else setRes("<p style=\"color:#ff4444\">Error: "+(d.error||JSON.stringify(d))+"</p>");
    }catch(e){setRes("<p style=\"color:#ff4444\">Request failed.</p>");}
  };
  document.getElementById("cr-content").innerHTML = forms.skill;
};
window.screenPortfolio = async function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Portfolio</h1><p class=\"htp-page-subtitle\">Your positions, history, and open orders on the Kaspa BlockDAG.</p><div style=\"display:flex;gap:10px;margin-bottom:24px;align-items:center\"><input id=\"pf-addr\" class=\"htp-input\" placeholder=\"kaspa:your-address...\" style=\"flex:1;max-width:480px\" /><button class=\"htp-btn\" onclick=\"htpLoadPortfolio()\">Load</button></div><div id=\"pf-content\"></div></div>";
  window.htpLoadPortfolio = async function() {
    var addr = ((document.getElementById("pf-addr")||{}).value||"").trim();
    var el = document.getElementById("pf-content"); if(!el) return;
    if(!addr){el.innerHTML="<p style=\"color:#ff4444\">Enter a Kaspa address.</p>";return;}
    el.innerHTML = "<p style=\"color:var(--htp-muted)\">Loading portfolio...</p>";
    try {
      var r = await fetch(B+"/api/portfolio/"+encodeURIComponent(addr));
      var d = await r.json();
      if(d.error){el.innerHTML="<p style=\"color:#ff4444\">Error: "+d.error+"</p>";return;}
      var games = d.games||[];
      var tWagered = d.total_wagered_sompi||0;
      var tWon = d.total_won_sompi||0;
      var wins = d.win_count||0;
      var losses = d.loss_count||0;
      var wr = (wins+losses)>0?Math.round(wins/(wins+losses)*100)+"%":"—";
      el.innerHTML = "<div class=\"htp-grid\" style=\"margin-bottom:24px\"><div class=\"htp-card\"><div class=\"htp-stat-label\">Total Volume</div><div class=\"htp-stat-val\">"+(tWagered/1e8).toFixed(2)+" KAS</div></div><div class=\"htp-card\"><div class=\"htp-stat-label\">Total Won</div><div class=\"htp-stat-val\">"+(tWon/1e8).toFixed(2)+" KAS</div></div><div class=\"htp-card\"><div class=\"htp-stat-label\">Win Rate</div><div class=\"htp-stat-val\">"+wr+"</div></div><div class=\"htp-card\"><div class=\"htp-stat-label\">Games</div><div class=\"htp-stat-val\">"+games.length+"</div></div></div>"+(games.length?"<h2 class=\"htp-section-title\">Games</h2><div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>ID</th><th>Type</th><th>Stake</th><th>Status</th><th>Winner</th><th></th></tr></thead><tbody>"+games.map(function(g){var s=(g.status||"open").toLowerCase();return"<tr><td style=\"font-family:monospace;font-size:.78rem;color:var(--htp-muted)\">"+(g.id||"").slice(0,10)+"…</td><td>"+(g.game_type||"—")+"</td><td style=\"font-weight:700;color:var(--htp-gold)\">"+((g.stake_sompi||0)/1e8).toFixed(2)+" KAS</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td><td style=\"font-family:monospace;font-size:.78rem\">"+(g.winner||"—").slice(0,10)+"…</td><td><button class=\"htp-btn htp-btn-sm\" onclick=\"window.location.hash='#/game/"+(g.id||"")+"'\">View</button></td></tr>";}).join("")+"</tbody></table></div>":"<p style=\"color:var(--htp-muted)\">No games found for this address.</p>");
    }catch(e){el.innerHTML="<p style=\"color:#ff4444\">Request failed.</p>";}
  };
  var wAddr = window.connectedAddress||(window.HTP_CONFIG&&window.HTP_CONFIG.walletAddress)||window._htpWalletAddress;
  if(wAddr){document.getElementById("pf-addr").value=wAddr;window.htpLoadPortfolio();}
};
window.screenOracle = async function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Oracle Network</h1><p class=\"htp-page-subtitle\">Bonded oracle nodes resolving outcomes on the Kaspa BlockDAG. Slash conditions enforced by covenant.</p><div class=\"htp-tab-bar\" id=\"or-tabs\"><button class=\"htp-tab htp-tab-act\" onclick=\"htpOrTab(this,'dashboard')\">Dashboard</button><button class=\"htp-tab\" onclick=\"htpOrTab(this,'register')\">Register Node</button><button class=\"htp-tab\" onclick=\"htpOrTab(this,'attest')\">Attest</button></div><div id=\"or-content\"><p style=\"color:var(--htp-muted)\">Loading oracle network...</p></div></div>";
  async function loadDash(el) {
    el.innerHTML = "<p style=\"color:var(--htp-muted)\">Fetching oracle network status...</p>";
    try {
      var r=await fetch(B+"/api/oracle/network");var d=await r.json();
      var oracles=d.oracles||d.nodes||[];
      var active=d.active_oracles||d.active||oracles.filter(function(o){return o.status==="active";}).length;
      var total=d.total_oracles||d.total||oracles.length;
      var quorum=d.quorum||d.min_quorum||Math.ceil(total/2)+1;
      el.innerHTML = "<div class=\"htp-grid\" style=\"margin-bottom:24px\"><div class=\"htp-card\"><div class=\"htp-stat-label\">Active Nodes</div><div class=\"htp-stat-val\">"+active+"</div></div><div class=\"htp-card\"><div class=\"htp-stat-label\">Total Registered</div><div class=\"htp-stat-val\">"+total+"</div></div><div class=\"htp-card\"><div class=\"htp-stat-label\">Quorum Required</div><div class=\"htp-stat-val\">"+quorum+"</div></div><div class=\"htp-card\"><div class=\"htp-stat-label\">Network Status</div><div class=\"htp-stat-val\" style=\"color:"+(active>=quorum?"#39ff90":"#ff9900")+"\">"+(active>=quorum?"LIVE":"LOW")+"</div></div></div>"+(oracles.length?"<h2 class=\"htp-section-title\">Registered Oracles</h2><div style=\"overflow-x:auto\"><table class=\"htp-table\"><thead><tr><th>Address</th><th>Bond</th><th>Slashes</th><th>Status</th></tr></thead><tbody>"+oracles.map(function(o){var s=(o.status||"active").toLowerCase();return"<tr><td style=\"font-family:monospace;font-size:.78rem\">"+(o.address||o.oracle_address||"").slice(0,14)+"…</td><td style=\"font-weight:700;color:var(--htp-gold)\">"+((o.bond_sompi||o.stake||0)/1e8).toFixed(2)+" KAS</td><td style=\"color:"+(o.slash_count||o.slashed?"#ff4444":"var(--htp-muted)")+"\">"+(o.slash_count||o.slashed||0)+"</td><td><span class=\"htp-badge htp-badge-"+s+"\">"+s.toUpperCase()+"</span></td></tr>";}).join("")+"</tbody></table></div>":"<p style=\"color:var(--htp-muted)\">No oracles registered yet.</p>");
    }catch(e){el.innerHTML="<p style=\"color:#ff4444\">Failed to load.</p>";}
  }
  function showReg(el) {
    el.innerHTML = "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px;font-size:1.1rem\">Register Oracle Node</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Bond KAS to become an oracle. Slashed if you attest falsely.</p><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"or-addr\" class=\"htp-input\" placeholder=\"kaspa:q...\" /></div><div class=\"htp-form-group\"><label>Bond (KAS)</label><input id=\"or-bond\" class=\"htp-input\" type=\"number\" placeholder=\"100\" step=\"1\" min=\"1\" /></div><button class=\"htp-btn\" onclick=\"htpRegOracle()\">Register on BlockDAG</button><div id=\"or-result\" style=\"margin-top:14px\"></div></div>";
    window.htpRegOracle = async function() {
      var addr=((document.getElementById("or-addr")||{}).value||"").trim();
      var bond=parseFloat((document.getElementById("or-bond")||{}).value||"0");
      var res=document.getElementById("or-result");if(!res)return;
      if(!addr||bond<=0){res.innerHTML="<p style=\"color:#ff4444\">Address and bond required.</p>";return;}
      res.innerHTML="<p style=\"color:var(--htp-muted)\">Registering...</p>";
      try{
        var r2=await fetch(B+"/api/oracle/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({oracle_address:addr,bond_sompi:Math.round(bond*1e8)})});
        var d=await r2.json();
        if(d.id||d.status==="registered")res.innerHTML="<p style=\"color:#39ff90\">✓ Oracle registered.</p>";
        else res.innerHTML="<p style=\"color:#ff4444\">Error: "+(d.error||JSON.stringify(d))+"</p>";
      }catch(e){res.innerHTML="<p style=\"color:#ff4444\">Request failed.</p>";}
    };
  }
  function showAtt(el) {
    el.innerHTML = "<div class=\"htp-form-card\"><h2 style=\"margin:0 0 20px;font-size:1.1rem\">Submit Attestation</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Attest an outcome. Bond at risk if quorum disagrees.</p><div class=\"htp-form-group\"><label>Event/Game ID</label><input id=\"or-evid\" class=\"htp-input\" placeholder=\"event-id\" /></div><div class=\"htp-form-group\"><label>Oracle Address</label><input id=\"or-oaddr\" class=\"htp-input\" placeholder=\"kaspa:q...\" /></div><div class=\"htp-form-group\"><label>Outcome</label><select id=\"or-outcome\" class=\"htp-input\"><option value=\"yes\">YES / Player A wins</option><option value=\"no\">NO / Player B wins</option><option value=\"draw\">DRAW</option></select></div><button class=\"htp-btn\" onclick=\"htpSubmitAtt()\">Submit Attestation</button><div id=\"or-result\" style=\"margin-top:14px\"></div></div>";
    window.htpSubmitAtt = async function() {
      var evid=((document.getElementById("or-evid")||{}).value||"").trim();
      var oaddr=((document.getElementById("or-oaddr")||{}).value||"").trim();
      var outcome=(document.getElementById("or-outcome")||{}).value||"yes";
      var res=document.getElementById("or-result");if(!res)return;
      if(!evid||!oaddr){res.innerHTML="<p style=\"color:#ff4444\">Event ID and address required.</p>";return;}
      res.innerHTML="<p style=\"color:var(--htp-muted)\">Submitting attestation...</p>";
      try{
        var r2=await fetch(B+"/api/oracle/attest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_id:evid,oracle_address:oaddr,outcome:outcome})});
        var d=await r2.json();
        if(d.id||d.status)res.innerHTML="<p style=\"color:#39ff90\">✓ Attestation submitted.</p>";
        else res.innerHTML="<p style=\"color:#ff4444\">Error: "+(d.error||JSON.stringify(d))+"</p>";
      }catch(e){res.innerHTML="<p style=\"color:#ff4444\">Request failed.</p>";}
    };
  }
  window.htpOrTab = function(btn,tab) {
    document.querySelectorAll("#or-tabs .htp-tab").forEach(function(b){b.classList.remove("htp-tab-act");});
    btn.classList.add("htp-tab-act");
    var el = document.getElementById("or-content");
    if(tab==="dashboard")loadDash(el);else if(tab==="register")showReg(el);else showAtt(el);
  };
  loadDash(document.getElementById("or-content"));
};
window.screenWallet = function() {
  var R = document.getElementById("htp-root");
  if (!R) return;
  var B = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || "https://hightable.pro";
  var stored = window._htpWalletAddress || window.connectedAddress || (window.HTP_CONFIG && window.HTP_CONFIG.walletAddress);
  function showConnect() {
    R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Wallet</h1><p class=\"htp-page-subtitle\">Connect your Kaspa wallet to create games and track positions.</p><div class=\"htp-form-card\"><h2 style=\"margin:0 0 6px;font-size:1.1rem\">Connect Wallet</h2><p style=\"color:var(--htp-muted);font-size:.85rem;margin:0 0 20px\">Enter your Kaspa address. Non-custodial — keys never leave your device.</p><div class=\"htp-form-group\"><label>Kaspa Address</label><input id=\"wlt-addr\" class=\"htp-input\" placeholder=\"kaspa:q...\" value=\""+(stored||"")+"\" /></div><button class=\"htp-btn\" onclick=\"htpConnectWallet()\">Connect</button></div></div>";
  }
  async function showDash(addr) {
    R.innerHTML = "<div class=\"htp-page\"><h1 class=\"htp-page-title\">Wallet</h1><p class=\"htp-page-subtitle\">Connected: <span style=\"font-family:monospace;font-size:.85rem;word-break:break-all\">"+addr+"</span></p><div id=\"wc-load\"><p style=\"color:var(--htp-muted)\">Loading balance...</p></div></div>";
    try {
      var r = await fetch(B+"/api/balance/"+encodeURIComponent(addr));
      var d = await r.json();
      if (d.error) throw new Error(d.error);
      var bal = ((d.balance_sompi||d.balance||0)/1e8).toFixed(4);
      document.getElementById("wc-load").innerHTML =
        "<div class=\"htp-grid\" style=\"margin-bottom:24px\"><div class=\"htp-card\"><div class=\"htp-stat-label\">Balance</div><div class=\"htp-stat-val\">"+bal+" KAS</div></div></div>" +
        "<div style=\"display:flex;gap:10px;flex-wrap:wrap\"><button class=\"htp-btn\" onclick=\"window.location.hash='#/portfolio'\">View Portfolio</button><button class=\"htp-btn\" onclick=\"window.location.hash='#/create'\">Create Game</button><button class=\"htp-btn\" onclick=\"window.location.hash='#/games'\">Browse Games</button>" +
        "<button class=\"htp-btn\" style=\"background:rgba(255,68,68,0.1);border:1px solid #ff4444;color:#ff4444\" onclick=\"htpDiscWallet()\">Disconnect</button></div>";
    } catch(e) {
      document.getElementById("wc-load").innerHTML = "<p style=\"color:#ff4444\">Failed to load balance: "+e.message+"</p>";
    }
  }
  window.htpConnectWallet = async function() {
    var addr = ((document.getElementById("wlt-addr")||{}).value||"").trim();
    if(!addr.startsWith("kaspa:")){R.innerHTML+="<p style=\"color:#ff4444;position:fixed;top:16px;right:16px;z-index:999\">Must start with kaspa:</p>";return;}
    window._htpWalletAddress = addr; window.connectedAddress = addr;
    try{ localStorage.setItem("htp_wallet_addr",addr); }catch(e){}
    await showDash(addr);
  };
  window.htpDiscWallet = function() {
    window._htpWalletAddress = null; window.connectedAddress = null;
    try{ localStorage.removeItem("htp_wallet_addr"); }catch(e){}
    showConnect();
  };
  if (stored && typeof stored === "string" && stored.startsWith("kaspa:")) showDash(stored);
  else showConnect();
};
