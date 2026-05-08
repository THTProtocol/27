// High Table Protocol — Orders API (Node/Express)
// Runs on :3001, proxied via nginx /api/orders → htp_orders
// Pairs open game/event orders and forwards matches to Rust htp-server on :3000

const express  = require('express');
const Database = require('better-sqlite3');
const app      = express();
app.use(express.json());

const DB_PATH = process.env.HTP_DB_PATH || '/root/htp/data/htp.db';
const PORT    = process.env.ORDERS_PORT  || 3001;
let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function uuid() {
  return 'ord-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// GET /api/orders — list open orders
app.get('/api/orders', (req, res) => {
  let sql    = "SELECT * FROM orders WHERE status='open'";
  const params = [];
  if (req.query.type) { sql += ' AND order_type=?'; params.push(req.query.type); }
  if (req.query.network) { sql += ' AND network=?'; params.push(req.query.network); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  const orders = getDb().prepare(sql).all(...params);
  res.json({ orders, count: orders.length });
});

// POST /api/orders — create order
app.post('/api/orders', (req, res) => {
  const { creator, order_type, game_type, event_id, outcome, stake_sompi, network, expires_at } = req.body;
  if (!creator || !order_type || !stake_sompi)
    return res.status(400).json({ error: 'missing fields: creator, order_type, stake_sompi' });
  const id  = uuid();
  const now = Math.floor(Date.now() / 1000);
  const exp = expires_at || (now + 86400);
  getDb().prepare(
    'INSERT INTO orders (id,creator,order_type,game_type,event_id,outcome,stake_sompi,network,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, creator, order_type, game_type || null, event_id || null, outcome || null, stake_sompi, network || 'tn12', now, exp);
  res.json({ id, status: 'open', created_at: now });
});

// GET /api/orders/stats
app.get('/api/orders/stats', (req, res) => {
  const d       = getDb();
  const open    = d.prepare("SELECT COUNT(*) as c FROM orders WHERE status='open'").get().c;
  const matched = d.prepare("SELECT COUNT(*) as c FROM orders WHERE status='matched'").get().c;
  const volume  = d.prepare('SELECT COALESCE(SUM(stake_sompi),0) as v FROM orders').get().v;
  res.json({ open_count: open, matched_count: matched, total_volume_sompi: volume });
});

// GET /api/orders/:id
app.get('/api/orders/:id', (req, res) => {
  const order = getDb().prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});

// POST /api/orders/:id/cancel
app.post('/api/orders/:id/cancel', (req, res) => {
  const order = getDb().prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order)                          return res.status(404).json({ error: 'not found' });
  if (order.status !== 'open')         return res.status(400).json({ error: 'order not open' });
  if (order.creator !== req.body.creator) return res.status(403).json({ error: 'not your order' });
  getDb().prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(req.params.id);
  res.json({ id: req.params.id, status: 'cancelled' });
});

// POST /api/orders/:id/match — match an order, forward to Rust
app.post('/api/orders/:id/match', async (req, res) => {
  const order = getDb().prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order)                  return res.status(404).json({ error: 'not found' });
  if (order.status !== 'open') return res.status(400).json({ error: 'order not open' });
  const matcher  = req.body.matcher || 'unknown';
  const rustBase = process.env.RUST_API || 'http://localhost:3000';
  try {
    let matchId;
    if (order.order_type === 'game') {
      const resp = await fetch(`${rustBase}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator:     order.creator,
          opponent:    matcher,
          game_type:   order.game_type || 'SkillGame',
          stake_sompi: order.stake_sompi,
        }),
      });
      const data = await resp.json();
      matchId = data.id || 'unknown';
    } else {
      matchId = order.event_id || 'unknown';
    }
    getDb().prepare("UPDATE orders SET status='matched', matched_by=?, match_id=? WHERE id=?").run(matcher, matchId, req.params.id);
    res.json({ id: req.params.id, status: 'matched', match_id: matchId, matched_by: matcher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`[htp-orders] listening on :${PORT}`));
