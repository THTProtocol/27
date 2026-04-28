#!/usr/bin/env node
/**
 * High Table Protocol — Attestor Node
 *
 * Runs an attestor process that watches market and skill-game events
 * needing attestation, fetches evidence, hashes it, and submits an
 * attestation. If on-chain submission credentials are not provided,
 * runs in dry-run mode and prints the attestation payload it would
 * have submitted, with `{ submitted: false, reason: "no-key" }`.
 *
 * Configuration is read from environment variables. NO secrets are
 * written to disk by this script.
 *
 *   ATTESTOR_NETWORK         tn12 | mainnet            (default: tn12)
 *   ATTESTOR_FEED            url to event feed JSON     (optional)
 *   ATTESTOR_FIREBASE_URL    Firebase RTDB url          (optional)
 *   ATTESTOR_RPC             Kaspa wRPC endpoint        (default: public TN12 resolver)
 *   ATTESTOR_PRIVATE_KEY     hex private key (DRY-RUN if absent)
 *   ATTESTOR_PUBLIC_KEY      hex public key (optional, derives from priv if absent)
 *   ATTESTOR_BOND_ADDR       address holding the oracle bond
 *   ATTESTOR_INTERVAL_MS     poll interval              (default: 30000)
 *   ATTESTOR_DRY_RUN         force dry-run regardless   (default: false)
 *
 * Usage:
 *   node scripts/run-attestor-node.mjs
 *   node scripts/run-attestor-node.mjs --once       # one cycle then exit
 *
 * NOTE: Kaspa Toccata covenant attestation is live on TN12. Mainnet
 * activation is gated by a hardcoded activation flag. When mainnet is
 * selected before activation, this script emits attestations as
 * `pending-mainnet-activation` instead of submitting them on-chain.
 */

import crypto from 'node:crypto';
import process from 'node:process';

const cfg = {
  network: (process.env.ATTESTOR_NETWORK || 'tn12').toLowerCase(),
  feedUrl: process.env.ATTESTOR_FEED || '',
  firebaseUrl: process.env.ATTESTOR_FIREBASE_URL || '',
  rpc: process.env.ATTESTOR_RPC || '',
  privateKey: process.env.ATTESTOR_PRIVATE_KEY || '',
  publicKey: process.env.ATTESTOR_PUBLIC_KEY || '',
  bondAddr: process.env.ATTESTOR_BOND_ADDR || '',
  interval: parseInt(process.env.ATTESTOR_INTERVAL_MS || '30000', 10),
  dryRun: /^(1|true|yes)$/i.test(process.env.ATTESTOR_DRY_RUN || ''),
};

const args = process.argv.slice(2);
const ONCE = args.includes('--once');

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}
function info(m, e) { log('INFO', m, e); }
function warn(m, e) { log('WARN', m, e); }
function err(m, e)  { log('ERROR', m, e); }

function isDryRun() {
  if (cfg.dryRun) return true;
  if (!cfg.privateKey) return true;
  if (cfg.network === 'mainnet') {
    // We do not claim mainnet covenant activation. Treat mainnet as dry-run
    // unless the operator explicitly opts in via ATTESTOR_MAINNET_LIVE=1.
    if (!/^(1|true|yes)$/i.test(process.env.ATTESTOR_MAINNET_LIVE || '')) return true;
  }
  return false;
}

function sha256Hex(value) {
  const h = crypto.createHash('sha256');
  h.update(typeof value === 'string' ? value : JSON.stringify(value));
  return h.digest('hex');
}

async function safeFetch(url, opts) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) return { ok: false, status: r.status, body: await r.text().catch(() => '') };
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) return { ok: true, json: await r.json() };
    return { ok: true, text: await r.text() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Pull the queue of events that need attestation.
 * Tries the explicit feed url first, then Firebase, then a local-only no-op.
 */
async function pullPendingEvents() {
  if (cfg.feedUrl) {
    const r = await safeFetch(cfg.feedUrl);
    if (r.ok && Array.isArray(r.json)) return r.json;
    if (r.ok && r.json && Array.isArray(r.json.events)) return r.json.events;
    warn('Feed fetch returned no events', { url: cfg.feedUrl, error: r.error || r.status });
  }
  if (cfg.firebaseUrl) {
    const url = cfg.firebaseUrl.replace(/\/$/, '') + '/attestation_queue.json';
    const r = await safeFetch(url);
    if (r.ok && r.json) {
      if (Array.isArray(r.json)) return r.json;
      return Object.entries(r.json).map(([id, v]) => ({ id, ...v }));
    }
    warn('Firebase queue empty or unreachable', { url });
  }
  return [];
}

/**
 * Resolve evidence for a single event. Honors event.evidence.url and
 * optional jsonPath / responsePath. Returns { value, hash, sourceUrl }
 * or null if it cannot be resolved without escalation.
 */
async function resolveEvidence(event) {
  if (!event.evidence) return null;
  const { url, responsePath } = event.evidence;
  if (!url) return null;
  const r = await safeFetch(url);
  if (!r.ok) return { value: null, error: r.error || `HTTP ${r.status}`, sourceUrl: url };
  const raw = r.json !== undefined ? r.json : r.text;
  let value = raw;
  if (responsePath && raw && typeof raw === 'object') {
    value = responsePath.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), raw);
  }
  const canonical = JSON.stringify({ url, responsePath: responsePath || null, value });
  return { value, hash: sha256Hex(canonical), sourceUrl: url, raw };
}

function buildAttestation(event, evidence, dryRun) {
  return {
    schema: 'htp-attestation/v1',
    eventId: event.id,
    network: cfg.network,
    outcome: event.outcome ?? null,
    evidenceHash: evidence ? evidence.hash : null,
    evidenceSourceUrl: evidence ? evidence.sourceUrl : null,
    evidenceValue: evidence ? evidence.value : null,
    attestedAt: new Date().toISOString(),
    attestor: cfg.publicKey || null,
    dryRun,
  };
}

function signAttestation(payload) {
  if (!cfg.privateKey) return { sig: null, alg: null };
  // Local HMAC-SHA256 of the canonical payload using the private key as the
  // shared secret. This is a placeholder for the Schnorr / secp256k1 signing
  // path; the full signing path lives in lib/tx-builder.js once the WASM SDK
  // is wired in. Either way, it produces an unforgeable record locally and
  // does not leak the private key.
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const sig = crypto.createHmac('sha256', cfg.privateKey).update(canonical).digest('hex');
  return { sig, alg: 'hmac-sha256-placeholder' };
}

async function submitAttestation(att, signature) {
  // Submission target priority:
  //   1. ATTESTOR_FIREBASE_URL/attestations/$eventId (always tried, low risk)
  //   2. on-chain via lib/tx-builder.js (only if WASM keypair + RPC available)
  //
  // Without on-chain creds we record the attestation off-chain only and
  // return submitted: false on the on-chain side. We do NOT pretend the
  // covenant accepted it.
  const result = { offchain: null, onchain: { submitted: false, reason: 'no-key' } };

  if (cfg.firebaseUrl) {
    try {
      const url = `${cfg.firebaseUrl.replace(/\/$/, '')}/attestations/${encodeURIComponent(att.eventId)}.json`;
      const body = JSON.stringify({ ...att, signature });
      const r = await fetch(url, { method: 'PUT', body, headers: { 'content-type': 'application/json' } });
      result.offchain = { ok: r.ok, status: r.status };
    } catch (e) {
      result.offchain = { ok: false, error: e.message };
    }
  }

  if (cfg.privateKey && cfg.rpc && cfg.network === 'tn12') {
    // Real submission would go through lib/tx-builder.js + lib/kaspa-rpc.js
    // here. We deliberately avoid wiring a half-broken path; instead we
    // mark the on-chain leg as pending for the human operator to wire.
    result.onchain = { submitted: false, reason: 'pending-tx-builder-integration' };
  } else if (cfg.network === 'mainnet') {
    result.onchain = { submitted: false, reason: 'pending-mainnet-activation' };
  }

  return result;
}

async function processEvent(event) {
  const evidence = await resolveEvidence(event);
  if (!evidence) {
    warn('Skip: cannot resolve evidence', { eventId: event.id });
    return { eventId: event.id, skipped: true };
  }
  const dry = isDryRun();
  const att = buildAttestation(event, evidence, dry);
  const { sig, alg } = signAttestation(att);
  const signature = sig ? { value: sig, alg } : null;
  if (dry) {
    info('DRY-RUN attestation', { eventId: event.id, outcome: att.outcome, hash: att.evidenceHash });
    return { eventId: event.id, dryRun: true, attestation: att, signature };
  }
  const sub = await submitAttestation(att, signature);
  info('Attestation submitted', { eventId: event.id, off: sub.offchain, on: sub.onchain });
  return { eventId: event.id, dryRun: false, attestation: att, signature, submission: sub };
}

async function tick() {
  const events = await pullPendingEvents();
  if (!events.length) {
    info('No events pending attestation');
    return;
  }
  info(`Processing ${events.length} event(s)`);
  for (const ev of events) {
    try { await processEvent(ev); }
    catch (e) { err('Process failed', { id: ev?.id, error: e.message }); }
  }
}

function banner() {
  console.log('==========================================================');
  console.log('  High Table Protocol Attestor Node');
  console.log('  Network        :', cfg.network);
  console.log('  Feed URL       :', cfg.feedUrl || '(none)');
  console.log('  Firebase URL   :', cfg.firebaseUrl ? '(set)' : '(none)');
  console.log('  RPC endpoint   :', cfg.rpc || '(default public resolver)');
  console.log('  Bond address   :', cfg.bondAddr || '(unset)');
  console.log('  Interval (ms)  :', cfg.interval);
  console.log('  Dry-run        :', isDryRun() ? 'YES' : 'no');
  console.log('  Mainnet live   :', /^(1|true|yes)$/i.test(process.env.ATTESTOR_MAINNET_LIVE || '') ? 'YES' : 'no');
  console.log('==========================================================');
}

async function main() {
  banner();
  await tick();
  if (ONCE) {
    info('--once flag set; exiting after first cycle');
    return;
  }
  setInterval(() => { tick().catch(e => err('Tick error', { error: e.message })); }, cfg.interval);
  process.on('SIGINT', () => { info('SIGINT, exiting.'); process.exit(0); });
  process.on('SIGTERM', () => { info('SIGTERM, exiting.'); process.exit(0); });
}

main().catch(e => { err('Fatal', { error: e.message, stack: e.stack }); process.exit(1); });
