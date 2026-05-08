# HTP API Reference

Base URL: `https://hightable.pro`  
All responses are JSON. No authentication required for read endpoints.

---

## Health & Config

### `GET /health`

```json
{
  "engine": "rust",
  "status": "ok",
  "version": "0.6.0",
  "uptime_secs": 3600
}
```

### `GET /api/stats`

```json
{
  "total_games": 23,
  "active_players": 4,
  "total_volume_kas": 142.5,
  "active_oracles": 3,
  "open_pools": 2,
  "total_orders": 11
}
```

### `GET /api/fees`

```json
{
  "protocol_fee_bps": 50,
  "oracle_fee_bps": 25,
  "min_wager_sompi": 10000000,
  "max_wager_sompi": 10000000000
}
```

---

## Games

### `GET /api/games`

Query params: `?limit=20&offset=0&status=active&game_type=chess`

```json
{
  "games": [
    {
      "id": "game_1778001234",
      "game_type": "chess",
      "player_a": "kaspa:qp...",
      "player_b": "kaspa:qp...",
      "wager_sompi": 100000000,
      "status": "active",
      "winner": null,
      "covenant_tx_id": null,
      "created_at": 1778001234
    }
  ],
  "count": 23,
  "total": 23
}
```

### `POST /api/games`

```json
// Request
{
  "game_type": "chess",
  "player_a":  "kaspa:qp_alice...",
  "player_b":  "kaspa:qp_bob...",
  "wager_sompi": 100000000
}

// Response
{
  "id": "game_1778001234",
  "status": "pending",
  "covenant_address": "kaspa:qp_covenant..."
}
```

---

## Oracle Network

### `POST /api/oracle/register`

```json
// Request
{
  "address": "kaspa:qp...",
  "bond_sompi": 500000000,
  "oracle_type": "hybrid",
  "m": 2,
  "n": 3
}

// Response
{
  "id": "oracle_1778264754",
  "address": "kaspa:qp...",
  "bond_sompi": 500000000,
  "oracle_type": "hybrid",
  "m": 2,
  "n": 3,
  "status": "pending",
  "message": "Registered. Send bond TX then activate."
}
```

### `POST /api/oracle/attest`

```json
// Request
{
  "game_id":    "game_abc123",
  "oracle_id":  "oracle_1778264754",
  "oracle_addr": "kaspa:qp...",
  "winner":     "kaspa:qp_winner...",
  "proof_root": "0000000000000000000000000000000000000000000000000000000000000000",
  "attest_type": "hybrid"
}

// Response
{
  "id": "attest_1778264781",
  "game_id": "game_abc123",
  "attested_count": 1,
  "required": 2,
  "quorum_reached": false
}
```

### `GET /api/oracle/network`

```json
{
  "oracles": {
    "total": 5,
    "active": 3,
    "pending": 1,
    "slashed": 1,
    "exited": 0
  },
  "total_bond_sompi": 1500000000,
  "total_bond_kas": 15.0,
  "total_attestations": 42,
  "quorums_reached": 18,
  "slash_events": 2
}
```

---

## Maximizer

### `POST /api/maximizer/pools/create`

```json
// Request
{
  "game_type":       "chess",
  "pool_cap_sompi":  1000000000,
  "min_bet_sompi":   10000000,
  "max_bet_sompi":   500000000
}

// Response
{
  "id": "pool_1778300000",
  "game_type": "chess",
  "pool_cap_sompi": 1000000000,
  "status": "open"
}
```

### `POST /api/maximizer/enter`

```json
// Request
{
  "pool_id":    "pool_1778300000",
  "player_addr": "kaspa:qp...",
  "bet_sompi":  100000000
}

// Success response
{
  "entry_id": "entry_kaspatest_1778300001",
  "pool_id": "pool_1778300000",
  "bet_sompi": 100000000,
  "pool_total_sompi": 100000000,
  "pool_cap_sompi": 1000000000,
  "pool_status": "open",
  "fill_pct": 10.0,
  "message": "Entry recorded"
}

// Over-cap rejection
{
  "error": "pool cap would be exceeded",
  "cap_sompi": 1000000000,
  "current_sompi": 950000000,
  "remaining_sompi": 50000000,
  "your_bet_sompi": 200000000,
  "max_you_can_bet_sompi": 50000000
}
```

---

## Auto-Settler

### `GET /api/settler/status`

```json
{
  "auto_settler": "running",
  "interval_secs": 30,
  "games_completed_pending_settlement": 0,
  "games_settled": 18,
  "oracle_quorums_pending": 2,
  "oracle_quorums_reached": 18
}
```

---

## Orders

### `POST /api/orders`

```json
// Request
{
  "player_addr": "kaspa:qp...",
  "game_type":   "chess",
  "wager_sompi": 100000000,
  "conditions":  "standard"
}

// Response
{
  "id": "order_1778400001",
  "status": "open"
}
```

### `POST /api/orders/:id/match`

```json
// Request
{
  "player_addr": "kaspa:qp_opponent..."
}

// Response
{
  "game_id": "game_1778400050",
  "order_id": "order_1778400001",
  "status": "matched"
}
```
