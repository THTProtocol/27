# Attestor Node

The High Table Protocol attestor node watches markets and skill games that
need attestation, fetches the referenced evidence, hashes it, signs the
attestation, and either submits it on-chain (when credentials and a live
covenant are available) or records a dry-run record that proves what *would*
have been submitted.

The script is at `scripts/run-attestor-node.mjs` and runs on Node 18+.

## Quick start

```bash
# dry-run (no key, no submission, just print what it would attest)
node scripts/run-attestor-node.mjs --once

# loop on the default 30-second cadence
node scripts/run-attestor-node.mjs
```

You can also run it via the npm script:

```bash
npm run attestor
npm run attestor:once
```

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `ATTESTOR_NETWORK` | `tn12` | `tn12` or `mainnet`. Mainnet treated as dry-run unless `ATTESTOR_MAINNET_LIVE=1`. |
| `ATTESTOR_FEED` | empty | URL returning a JSON array (or `{events: [...]}`) of events needing attestation. |
| `ATTESTOR_FIREBASE_URL` | empty | RTDB URL such as `https://hightable420.firebaseio.com`. |
| `ATTESTOR_RPC` | public TN12 resolver | Kaspa wRPC endpoint. |
| `ATTESTOR_PRIVATE_KEY` | empty | Hex private key. **Never commit.** Without it the node runs in dry-run mode. |
| `ATTESTOR_PUBLIC_KEY` | empty | Optional. Recorded in attestations as `attestor`. |
| `ATTESTOR_BOND_ADDR` | empty | Address holding the oracle bond. |
| `ATTESTOR_INTERVAL_MS` | `30000` | Poll interval in milliseconds. |
| `ATTESTOR_DRY_RUN` | empty | Force dry-run regardless of credentials. |
| `ATTESTOR_MAINNET_LIVE` | empty | Opt-in flag to allow mainnet on-chain submission. Disabled until Toccata mainnet activation. |

Secrets should be set via your shell, a `.env` file your shell sources, or
your hosting platform's secret manager. They should never be checked in.

## What it does each cycle

1. Pull the pending event queue from `ATTESTOR_FEED` first, then Firebase
   `attestation_queue`. Both endpoints are optional; if neither responds,
   the cycle ends with no events processed.
2. For each event:
   - Resolve the referenced evidence by fetching `evidence.url` and walking
     `evidence.responsePath` if present.
   - Build a canonical SHA-256 hash over `{url, responsePath, value}`.
   - Build the attestation payload with the network, the attestor public
     key, and the evidence hash.
   - Sign the payload using the local key. The current implementation uses
     HMAC-SHA256 as a placeholder for the Schnorr / secp256k1 covenant
     signature path; the full path is wired through `lib/tx-builder.js`
     once the WASM SDK keypair is loaded.
3. Submit the attestation:
   - **Off-chain leg**: write to Firebase under
     `attestations/{eventId}` so the rest of the protocol UI can display
     the attestation status immediately. This always runs if Firebase is
     configured.
   - **On-chain leg**: only attempted when `ATTESTOR_PRIVATE_KEY`,
     `ATTESTOR_RPC`, and `network === 'tn12'` are all set. In every other
     situation we record the on-chain leg as `submitted: false` with a
     specific `reason`, so the operator can see what is missing. We never
     report a fake on-chain success.

## Toccata / mainnet caveat

Kaspa Toccata enables native L1 covenants via Silverscript and ZK
infrastructure under KIPs 16, 17, 20, and 21. Toccata is live on TN12 only.
Mainnet activation is gated by a hardcoded activation flag and is not yet
shipped. Until then this script defaults to dry-run when
`ATTESTOR_NETWORK=mainnet`. To opt in for testing once mainnet activates,
set `ATTESTOR_MAINNET_LIVE=1` explicitly.

## Output

The script logs structured lines to stdout:

```
[2026-04-28T12:34:56.789Z] [INFO] DRY-RUN attestation { eventId: 'M-...', outcome: 1, hash: '...' }
[2026-04-28T12:34:56.991Z] [INFO] Attestation submitted { eventId: 'M-...', off: { ok: true }, on: { submitted: false, reason: 'pending-tx-builder-integration' } }
```

Pipe to your aggregator of choice. The script does not write to disk.

## Safety

- The script never logs the private key.
- The script never tells the UI a covenant has accepted a submission it
  has not. The on-chain leg is explicit about its state.
- HTTP failures on evidence resolution result in a skipped event with a
  warning, not a forged attestation.
