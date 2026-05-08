# Information Markets

Information markets in High Table Protocol allow participants to allocate stake toward outcomes they believe will occur. Stake is redistributed to participants who signalled correctly, proportional to their allocation.

## How It Works

1. **Create a market** — define a question, resolution condition, deadline (DAA score), and oracle quorum
2. **Allocate stake** — participants commit KAS to their predicted outcome
3. **Oracle resolution** — bonded operators independently verify the outcome and submit attestations
4. **Settlement** — when quorum is reached, the market closes and stake is redistributed

## Market Structure

```json
{
  "name": "KAS/USDT price at block 5000000",
  "description": "Will KAS be above $0.10 USDT at Kaspa block 5000000?",
  "outcomes": ["above", "at-or-below"],
  "resolve_block": 5000000,
  "quorum_m": 3,
  "quorum_n": 5,
  "network": "tn12"
}
```

## Oracle Attestation

Each operator submits a deterministic commitment:

```
attestation_hash = HMAC-SHA256(
  market_id ‖ outcome ‖ observed_value ‖ daa_score,
  operator_signing_key
)
```

When `m` operators submit matching attestation hashes, the market is finalised.

## Redistribution

Stake is redistributed to correct-outcome participants proportionally:

```
payout_i = stake_i / total_correct_stake × total_pool × 0.98
protocol_fee = total_pool × 0.02
```

## API

```http
POST /api/events                    # create market
GET  /api/events                    # list open markets
GET  /api/events/:id                # market detail + current allocations
POST /api/events/:id/attest         # oracle operator submits attestation
GET  /api/events/:id/attestations   # list attestations
```

## Oracle Operator Requirements

- Minimum bond: **1,000 KAS**
- Bond is slashed for provably dishonest attestations
- Operators must be registered via `POST /api/operators` before attesting
