/**
 * watcher.js — HTP Settlement Watcher v2.1
 * 
 * Run from: /htp-oracle-daemon/
 *   cd /path/to/project/htp-oracle-daemon
 *   npm install
 *   node watcher.js
 * 
 * Required .env (in same folder as this file):
 *   FIREBASE_DB_URL=https://hightable420-default-rtdb.firebaseio.com
 *   FIREBASE_SERVICE_KEY=../serviceAccountKey.json   (relative to this file)
 *   HTP_ONCE=false   (set true to run once and exit, e.g. for cron)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const admin = require('firebase-admin');
const path  = require('path');

// ── Firebase init ────────────────────────────────────────────────────────────
const FIREBASE_DB_URL  = process.env.FIREBASE_DB_URL;
const SERVICE_KEY_PATH = process.env.FIREBASE_SERVICE_KEY
  ? path.resolve(__dirname, process.env.FIREBASE_SERVICE_KEY)
  : path.join(__dirname, 'serviceAccountKey.json');

if (!FIREBASE_DB_URL) {
  console.error('[WATCHER] FATAL: FIREBASE_DB_URL not set in .env');
  process.exit(1);
}

if (!admin.apps.length) {
  let svc;
  try {
    svc = require(SERVICE_KEY_PATH);
  } catch (e) {
    console.error('[WATCHER] FATAL: Cannot load service account key at', SERVICE_KEY_PATH);
    console.error('  Download from: Firebase Console → Project Settings → Service Accounts');
    process.exit(1);
  }
  admin.initializeApp({
    credential:  admin.credential.cert(svc),
    databaseURL: FIREBASE_DB_URL
  });
}

const db = admin.database();

// ── Config ───────────────────────────────────────────────────────────────────
const TIMEOUT_MS      = 10 * 60 * 1000; // 10 min: expire unjoined matches
const POLL_MS         = 30 * 1000;       // 30s poll interval
const PRESENCE_TTL_MS = 90 * 1000;       // 90s: declare player offline

// ── Helpers ──────────────────────────────────────────────────────────────────
async function safeSet(ref, value) {
  try { await ref.set(value); } catch (e) { console.error('[WATCHER] DB write failed:', e.message); }
}

async function safeUpdate(ref, value) {
  try { await ref.update(value); } catch (e) { console.error('[WATCHER] DB update failed:', e.message); }
}

// ── Main poll ────────────────────────────────────────────────────────────────
async function poll() {
  const snap = await db.ref('matches').once('value').catch(() => null);
  if (!snap || !snap.val()) {
    console.log('[WATCHER] No matches found');
    return;
  }

  const now     = Date.now();
  const matches = snap.val();

  for (const [id, m] of Object.entries(matches)) {
    if (!m || !m.info) continue;

    const status = m.info.status;

    // ── 1. Expire waiting matches that were never joined ──────────────────
    if (status === 'waiting' && (now - (m.info.created || 0)) > TIMEOUT_MS) {
      await safeUpdate(db.ref(`matches/${id}/info`), {
        status:    'expired',
        expiredAt: now
      });
      console.log(`[WATCHER] Expired unjoined match: ${id}`);
      continue;
    }

    // ── 2. Flag finished matches that haven't been settle-checked ─────────
    if (status === 'finished' && !m.info.settleChecked) {
      await safeUpdate(db.ref(`matches/${id}/info`), {
        settleChecked: true,
        settleStatus:  'awaiting-wallet-signature',
        checkedAt:     now
      });
      console.log(`[WATCHER] Flagged finished match for settlement: ${id}`);
    }

    // ── 3. Forfeit by disconnect (presence check) ─────────────────────────
    if (status === 'active' && m.presence) {
      const players = m.info.players || {};
      const creatorAddr   = players.creatorAddrFull;
      const opponentAddr  = players.opponentAddrFull;

      for (const [addr, presenceData] of Object.entries(m.presence)) {
        if (!presenceData || !presenceData.lastSeen) continue;
        const offline = (now - presenceData.lastSeen) > PRESENCE_TTL_MS;
        if (!offline) continue;

        const offlinePlayer = addr;
        const onlineAddr    = offlinePlayer === creatorAddr ? opponentAddr : creatorAddr;

        if (!onlineAddr) {
          console.warn(`[WATCHER] Cannot resolve winner for match ${id} — skipping forfeit`);
          continue;
        }

        await safeUpdate(db.ref(`matches/${id}/info`), {
          status:      'forfeit',
          winner:      onlineAddr,
          forfeitedBy: offlinePlayer,
          reason:      'disconnect',
          settledAt:   now
        });
        console.log(`[WATCHER] Forfeit: ${offlinePlayer.slice(0, 20)}... lost match ${id}`);
        break; // only one forfeit per match
      }
    }
  }
}

// ── Entry ─────────────────────────────────────────────────────────────────────
console.log('[WATCHER] HTP Settlement Watcher v2.1 starting...');
console.log(`[WATCHER] Firebase: ${FIREBASE_DB_URL}`);
console.log(`[WATCHER] Poll interval: ${POLL_MS / 1000}s`);

poll(); // immediate first run

if (process.env.HTP_ONCE !== 'true') {
  setInterval(poll, POLL_MS);
} else {
  console.log('[WATCHER] HTP_ONCE=true — exiting after single run');
  poll().then(() => process.exit(0));
}

process.on('SIGINT',  () => { console.log('[WATCHER] Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('[WATCHER] Shutting down...'); process.exit(0); });
