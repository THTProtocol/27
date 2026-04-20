# High Table Protocol - Codebase Analysis Guidelines

## Purpose

This document defines the standards and procedures for automated codebase analysis within the HTP ecosystem.

## Analysis Pipeline

### Phase 1: Repository Ingestion
1. Clone target repository into temporal workspace
2. Enumerate source files by language/extension
3. Classify based on Project Reference hierarchy

### Phase 2: Code Parsing
- **Rust sources**: Parse for study patterns (covenants, lock scripts, transaction logic)
- **WebAssembly interfaces**: Identify WASM bindings and JS/TS wrappers
- **RPC definitions**: Extract proto/gRPC service definitions

### Phase 3: Covenant Extraction

Covenants are identified by:

1. **Pattern Matching**:
   - Function naming: `create_*_covenant`, `validate_*`
   - Struct fields: `lock_time`, `hash_lock`, `sequence`
   - Opcode sequences: `OP_CHECKSIG`, `OP_CSV`

2. **File Locations**:
   ```
   consensus/core/src/tx/
   wallet/core/src/utxo/
   rpc/core/src/
   ```

3. **Test Files**:
   Files matching `*test*.rs` with covenant-related assertions

## Study Categories

### Category A: Transaction Flow
- Input validation
- Output creation
- Fee calculation
- Script execution

### Category B: Network Layer
- P2P message handling
- Block propagation
- Mempool management

### Category C: RPC Interface
- gRPC method handlers
- REST endpoints
- WebSocket subscriptions

### Category D: Covenant Logic
- Script opcodes
- Lock time validations
- Preimage requirements
- Multi-signature schemes

## Reporting Format

All analyses produce structured output:

```json
{
  "repository": "kaspanet/rusty-kaspa",
  "branch": "tn12",
  "files_analyzed": 1234,
  "covenants_found": [
    {
      "type": "htlc",
      "file": "consensus/core/src/tx/htlc.rs",
      "line_range": [45, 120],
      "complexity_score": 7.5
    }
  ],
  "dependencies": [...],
  "risk_assessment": "low"
}
```

## Agent Integration

The CodeAnalyzer agent:
- Receives `htp:cov [TARGET]` commands
- Publishes findings to AnytingLLM workspace
- Updates Redis event stream for real-time sync
- Writes to AGENT_NOTES.md on completion
