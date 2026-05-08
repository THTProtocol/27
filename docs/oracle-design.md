# HTP Oracle Network Design

## Overview

High Table Protocol uses a **bonded m-of-n oracle system** for outcome attestation. Oracles are economically incentivized to attest truthfully through bond deposits and slashing.

## Oracle Lifecycle

```
pending → active → slashed
                 ↘ exited
```

### Registration

```http
POST /api/oracle/register
{
  "address":     "kaspa:qp...",   // Oracle Kaspa address
  "bond_sompi":  500000000,        // Min 1 KAS (100,000,000 sompi)
  "oracle_type": "hybrid",         // zk | bond | hybrid
  "m":           2,                // Signatures required
  "n":           3                 // Total oracles in set
}
```

Minimum bond: **1 KAS (100,000,000 sompi)**

### Activation

After broadcasting the bond TX on the Kaspa BlockDAG:

```http
POST /api/oracle/:id/activate
{
  "bond_tx_id": "kaspa_tx_hash..."
}
```

Oracle status changes from `pending` → `active`.

### Attestation

```http
POST /api/oracle/attest
{
  "game_id":     "game_abc",
  "oracle_id":   "oracle_xyz",
  "oracle_addr": "kaspa:qp...",
  "winner":      "kaspa:qp_winner...",
  "proof_root":  "0000...0000",       // ZK proof root (hybrid: zeros)
  "attest_type": "hybrid"
}
```

### Quorum

Once `m` oracles have attested the same `winner` for a `game_id`:

1. `oracle_quorum_results.status` → `reached`
2. Auto-settler picks this up within 30 seconds
3. `games.status` → `settled`, `games.winner` set
4. Covenant UTXO unlockable by winner

### Slashing

```http
POST /api/oracle/slash
{
  "oracle_id":  "oracle_xyz",
  "game_id":    "game_abc",
  "reason":     "attested_wrong_winner",
  "reported_by": "kaspa:qp_reporter..."
}
```

- Slash amount: 10% of `bond_sompi` per fault
- 3 slashes → permanent exclusion (`status: slashed`)
- Slash records stored in `oracle_slashes` table

## Oracle Types

| Type | Description | Proof Required |
|------|-------------|----------------|
| `bond` | Economic bond only, no ZK proof | None |
| `zk` | Zero-knowledge proof of computation | ZK proof root |
| `hybrid` | Bond + optional ZK proof | Optional |

## Economics

For a 2-of-3 oracle set with 1 KAS bond each:

- Colluding to cheat requires coordinating 2 oracles
- Each dishonest oracle risks losing their full bond
- Cost of attack: ≥2 KAS forfeited per game corrupted
- As game wagers grow, honest attestation becomes more valuable

## Network Stats

```http
GET /api/oracle/network

{
  "oracles": {
    "total": 5,
    "active": 3,
    "pending": 1,
    "slashed": 1
  },
  "total_bond_sompi": 1500000000,
  "total_attestations": 42,
  "quorums_reached": 18
}
```
