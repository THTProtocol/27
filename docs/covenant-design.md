# HTP Covenant Design

## Overview

HTP uses Kaspa's UTXO model with covenant-style locking scripts to enforce
non-custodial game payouts. No party can redirect funds without a valid
oracle quorum attestation.

## Game UTXO Structure

When a game is created, both players send their wagers to a covenant address:

```
player_a wager  ──┐
                  ├──► covenant_utxo(game_id)
player_b wager  ──┘
```

The covenant UTXO is locked by a script that enforces:

```
UNLOCK IF:
  condition_1: winner_sig(attested_winner) AND oracle_quorum_sig(game_id)
  OR
  condition_2: sig(player_a) AND sig(player_b) AND blockheight > timeout
```

## Covenant Script (KaspaSilver)

```
; Game payout covenant
; Parameters: game_id, player_a_pk, player_b_pk, timeout_height

OP_IF
  ; Condition 1: Oracle-attested winner
  OP_CHECKQUORUMSIG game_id m_of_n
  OP_CHECKSIG winner_pk
OP_ELSE
  ; Condition 2: Mutual refund after timeout
  OP_CHECKLOCKTIMEVERIFY timeout_height
  OP_2DROP
  OP_2 player_a_pk player_b_pk OP_2 OP_CHECKMULTISIG
OP_ENDIF
```

## Security Properties

1. **Non-custodial**: Contract address is deterministic from game parameters
2. **No admin escape**: No third key can unlock funds
3. **Timeout safety**: Players can recover funds if oracles are unresponsive
4. **Oracle binding**: The specific oracle set is committed at game creation

## Transaction Flow

```
Block N:     game_create TX  (locks player_a + player_b wagers)
Block N+?:   oracle attest TXs (recorded on BlockDAG)
Block N+?:   quorum reached → auto-settler fires
Block N+?:   payout TX (covenant unlocked by winner sig)
```

## Covenant Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `timeout_blocks` | 1440 | ~24h at 1 BPS |
| `min_wager_sompi` | 10,000,000 | 0.1 KAS minimum |
| `max_wager_sompi` | 10,000,000,000 | 100 KAS maximum |
| `oracle_set_size` | 3 | Default n |
| `quorum_threshold` | 2 | Default m |

## Status

Covenant scripts are currently in development for Kaspa mainnet.
Testnet (TN12) uses the oracle quorum result directly without
on-chain script enforcement — the server enforces covenant logic.
Full on-chain covenant enforcement ships with mainnet migration.
