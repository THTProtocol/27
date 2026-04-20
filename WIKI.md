# High Table Protocol (HTP) Documentation Wiki

## Overview

The High Table Protocol (HTP) is a multi-agent infrastructure for autonomous AI-driven development and operation of Kaspa covenant-based financial systems.

## Core Components

### Agent Architecture
- **DispatchAgent**: Coordinates task distribution and monitoring
- **CodeAnalyzer**: Performs codebase analysis and covenants extraction
- **BuildAgent**: Handles compilation, testing, and deployment
- **Validator**: Verifies covenant compliance and execution safety

### Kaspa Covenants

Covenants are Kaspa script conditions that restrict how outputs can be spent:

```rust
// Example covenant structure
pub struct Covenant {
    version: u8,
    payload: Vec<u8>,
    signature: Vec<u8>,
}
```

#### Covenant Types
1. **HTLC** (Hash Timelocked Contracts) - Time and hash conditions
2. **MultiSig** - Multi-signature requirements
3. **Vault** - Time-delayed withdrawals with cancellation
4. **Unvault** - Layered security for cold storage

### RPC Communication

The HTP stack communicates via gRPC and WebSocket with the Kaspa network:

```bash
# Kaspa RPC endpoint (tn12 testnet)
KASPA_RPC=http://localhost:16210
CHAIN=MAINNET  # or TN11/TN12 for testnets
```

## Protocol Commands

| Command | Description |
|---------|-------------|
| `htp:orbit [REPO_URL]` | Ingest a codebase into orbital memory |
| `htp:cov [TARGET]` | Extract covenant contracts from code |
| `htp:watch [SOURCE]` | Monitor external data feeds |
| `htp:build [URI]` | Execute build and deployment sequence |
| `htp:test [SCOPE]` | Run validated test scenarios |
| `htp:report` | Generate execution summary |

## Docker Infrastructure

```yaml
# Core Services
anythingllm:   # Knowledge base (port 3030)
n8n:           # Workflow automation (port 5678)
litellm:       # LLM gateway (port 4000)
mirofish:      # Multi-agent swarms (port 5001)
redis:         # Event bus (port 6379)
```

## Security Model

- All covenant execution is sandboxed
- Testnet default (TN12) for development
- RPC validation before mainnet deployment
- Agent credentials isolated per environment

## Maximizer Bets

The Maximizer Bet mechanism enhances parimutuel markets by allowing bettors to hedge 50% of their stake while maintaining full payout odds.

### How Maximizer Bets Work

- **Placing a Maximizer Bet**: When betting X KAS as a maximizer:
  - X/2 KAS goes to the parimutuel pool
  - X/2 KAS is held in the MaximizerEscrow covenant as a hedge

- **On Win**: The bettor is paid as if the full X KAS was in the pool × parimutuel odds
  - A 2% fee is taken from the winning payout
  - The hedge (X/2) is released from escrow and returned to the bettor

- **On Lose**: The bettor can claim back the hedge portion minus 30% protocol fee
  - Returns: X/2 × 0.7 = 0.35X KAS (35% of original bet)
  - The other side of the maximizer fee (30% of hedge) goes to ecosystem rewards

- **Effect on Odds**: Maximizer bets dilute odds — they count as X in payout math but only contribute X/2 to the pool. This rewards regular bettors who take full risk.

### Creator Control Mechanics

Market creators configure maximizer bets via two parameters:

| Parameter | Description | Range |
|-----------|-------------|-------|
| maximizer_limit_pct | Maximum maximizer size as % of pool | 0-100% (0 = disabled, 100 = unlimited) |
| expected_volume | Creator's estimate of total pool volume | Minimum 1 KAS |

The actual maximizer allowed scales automatically:
```
max_maximizer = max(expected_volume × limit_pct/100, actual_pool × limit_pct/100)
```

As real volume grows, the limit increases proportionally.

### Fee Structure

| Scenario | Fee | Who Pays |
|----------|-----|----------|
| Win (any bet) | 2% of winnings | Winner |
| Lose maximizer hedge claim | 30% of hedge | Loser |
| Skill game win | 2% of pot | Winner |
| Creator cancel (before start) | 0% | Nobody |
| Creator/player forfeit | 2% of pot | Opponent receives rest |

### Treasury Addresses

**Mainnet Treasury**: `kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel`

**Testnet12 Treasury**: `kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m`

### Opcodes Used

- **OP_TXID**: Binds covenant to game outcome transaction
- **OP_UTXOAMOUNT**: Verifies bet amounts trustlessly on-chain
- **OP_OUTPOINT**: Verifies bettor UTXO ownership
- **minimum 1 KAS**: Anti-spam threshold for all bets

## References

- Kaspa Rust Implementation: https://github.com/kaspanet/rusty-kaspa
- Rust cookbook: https://kaspa-none.github.io/kaspa-wasm/docs/cookbook/rust
- Web3 SDK: https://kaspa-none.github.io/kaspa-wasm/
