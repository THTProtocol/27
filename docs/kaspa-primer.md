# Kaspa — Technical Primer

A concise reference for contributors who need to understand the DAG layer that High Table Protocol settles on.

## GHOSTDAG

Kaspa uses the **GHOSTDAG** protocol — a mathematically proven extension of Nakamoto (Bitcoin) consensus to directed acyclic graphs. Key properties:

- Parallel blocks are **included**, not orphaned. All honest miner work contributes to chain weight.
- Consensus ordering is determined by a "bluest" subDAG selected by the GHOSTDAG algorithm.
- Security parameter `k` bounds the number of parallel blocks assumed in any honest DAG epoch.
- Current mainnet: **10 blocks per second (BPS)**, sub-second block inclusion latency.
- Peak measured throughput (Oct 2025 stress test): **5,584 TPS** — sustained on live mainnet.

## DAGKnight

**DAGKnight** is the next consensus upgrade — a parameterless evolution of GHOSTDAG:

- No hardcoded latency parameter; the protocol self-stabilizes as network conditions change.
- Stronger theoretical resistance to 50% attacks without relying on latency assumptions.
- Adaptive to infrastructure improvements over time.
- Roadmap target: **32 BPS → 100 BPS** as DAGKnight and hardware scale.

## Timelocks — DAA Score, Not Wall-Clock

Kaspa timelocks are expressed in **DAA score** (Difficulty Adjustment Algorithm block count), not Unix timestamps. This is critical for covenant design:

```
// Do NOT use:
require timestamp > expiry_unix

// Correct for Kaspa:
require daa_score > deadline_daa
```

At 10 BPS, 1 hour ≈ 36,000 DAA score. At 32 BPS (future), recalibrate accordingly.

## Proof-of-Work

Kaspa uses **kHeavyHash** — a custom ASIC-friendly PoW algorithm. Zero premine, zero VC allocation, fair launch. The emission schedule halves annually ("chromatic halvings").

## Toccata Hard Fork

Toccata activates **covenant opcodes** on mainnet — enabling SilverScript smart contracts. This is the prerequisite for High Table Protocol’s trustless on-chain escrow and information market settlement.

## Useful Endpoints (TN12 Testnet)

```
REST API:   https://api-tn12.kaspa.org
WebSocket:  wss://ws-tn12.kaspa.org
Explorer:   https://explorer-tn12.kaspa.org
```

## Further Reading

- [Kaspa.org](https://kaspa.org)
- [GHOSTDAG paper](https://eprint.iacr.org/2018/104)
- [DAGKnight whitepaper](https://kaspa.org/updated-dagknight-whitepaper-released/)
- [rusty-kaspa](https://github.com/kaspanet/rusty-kaspa)
