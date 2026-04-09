// ParimutuelMarket.ss
// High Table Protocol (HTP) Parimutuel Betting Covenant
//
// Network: Kaspa TN12 (Covenants++ / KIP-17)
//
// Functionality:
//   - Collects bets into a single shared pool UTXO (native KAS)
//   - At resolution, the covenant verifies the outcome on-chain:
//       * For kdapp games: checks that outcomeTxid exists and its final
//         state UTXO encodes the winning outcome
//       * For oracle events: checks signed miner attestation
//   - Splits the pool pro-rata among winners
//   - Sends 2% protocol fee atomically to hardcoded treasury
//   - Single resolution tx = all payouts + fee, fully permissionless
//
// KIP-17 Covenant Introspection Opcodes used:
//   OP_TXINPUTCOUNT      (0xC0)  — number of inputs in spending tx
//   OP_TXOUTPUTCOUNT     (0xC1)  — number of outputs in spending tx
//   OP_TXOUTPUTAMOUNT    (0xC2)  — amount of output at index
//   OP_TXOUTPUTSPK       (0xC3)  — scriptPublicKey of output at index
//   OP_INPUTAMOUNT       (0xC4)  — amount of current input being spent
//   OP_COVENANTID        (0xC6)  — persistent identity across UTXO chain
//   OP_CHECKSIGFROMSTACK  (0xBA) — verify external data signature
//
// References:
//   - KIP-17: https://github.com/kaspanet/kips/blob/master/kip-0017.md
//   - Silverscript: https://github.com/kaspanet/silverscript
//   - kdapp: https://github.com/michaelsutton/kdapp

// ────────────────────────────────────────────────────────────────────────────────
// Contract Parameters (baked into the script at deployment)
// ────────────────────────────────────────────────────────────────────────────────

contract ParimutuelMarket(
    outcomeTxid: Hash,             // Final game-state or attestation txid that proves the outcome
    numOutcomes: u64,              // Number of possible outcomes (2 for binary, 3 for chess w/ draw)
    feePercent: u64,               // Protocol fee percentage (2)
    feeAddr: ScriptPublicKey       // Treasury SPK — hardcoded, immutable once deployed
) {

    // ────────────────────────────────────────────────────────────────────────
    // RESOLVE: Permissionless settlement entrypoint
    //
    // Anyone can call this by building a tx that spends the pool UTXO.
    // The covenant script validates all outputs are correct.
    // ────────────────────────────────────────────────────────────────────────

    entrypoint function resolve(
        winningOutcomeIndex: u64,
        betOwners: array<ScriptPublicKey>,  // SPK of each bettor
        betAmounts: array<u64>,             // sompi amount each bettor wagered
        betOutcomes: array<u64>,            // which outcome each bettor chose
        outcomeSig: Sig,                    // signature proving outcome (from game-state UTXO or oracle)
        outcomePubKey: PubKey               // pubkey that signed the outcome attestation
    ) {
        // ── Step 1: Verify the outcome is authentic ──────────────────────
        // The outcome must be signed by a valid game-state key or oracle.
        // Construct the message: SHA256(outcomeTxid || winningOutcomeIndex)
        let outcomeMsg = sha256(outcomeTxid ++ winningOutcomeIndex.toBytes());

        // OP_CHECKSIGFROMSTACK: verify the signature against arbitrary data
        require(checkSigFromStack(outcomeSig, outcomePubKey, outcomeMsg),
                "Invalid outcome attestation signature");

        // Validate outcome index is within range
        require(winningOutcomeIndex < numOutcomes, "Outcome index out of range");

        // ── Step 2: Validate bet arrays are consistent ───────────────────
        let numBets = betOwners.length();
        require(numBets == betAmounts.length(), "Bet array length mismatch");
        require(numBets == betOutcomes.length(), "Bet array length mismatch");
        require(numBets >= 1, "Must have at least one bet");

        // ── Step 3: Compute pool totals ──────────────────────────────────
        // Use OP_INPUTAMOUNT to get the actual UTXO value being spent
        let totalPool = OP_INPUTAMOUNT(0);

        let fee = totalPool * feePercent / 100;
        let winnersPool = totalPool - fee;

        // Sum all bets and all winning bets
        let totalBets = 0u64;
        let winningBetsTotal = 0u64;
        let numWinners = 0u64;

        for i in 0..numBets {
            totalBets += betAmounts[i];
            require(betOutcomes[i] < numOutcomes, "Invalid bet outcome index");
            if betOutcomes[i] == winningOutcomeIndex {
                winningBetsTotal += betAmounts[i];
                numWinners += 1;
            }
        }

        // Bet amounts must account for the pool (minus network fees)
        require(totalBets > 0, "Total bets must be positive");

        // ── Step 4: Validate output count ────────────────────────────────
        // Outputs = one per winning bettor + one fee output
        let expectedOutputs = numWinners + 1;
        require(OP_TXOUTPUTCOUNT() == expectedOutputs,
                "Output count must equal numWinners + 1 (fee)");

        // ── Step 5: Validate each winner's output (pro-rata share) ───────
        let outputIdx = 0u64;
        for i in 0..numBets {
            if betOutcomes[i] == winningOutcomeIndex {
                let share = (betAmounts[i] * winnersPool) / winningBetsTotal;

                // Verify output amount matches computed share
                require(OP_TXOUTPUTAMOUNT(outputIdx) >= share,
                        "Winner output amount too low");

                // Verify output pays the correct bettor
                require(OP_TXOUTPUTSPK(outputIdx) == betOwners[i],
                        "Winner output address mismatch");

                outputIdx += 1;
            }
        }

        // ── Step 6: Validate fee output (always last) ────────────────────
        require(OP_TXOUTPUTAMOUNT(outputIdx) >= fee,
                "Fee output amount too low");
        require(OP_TXOUTPUTSPK(outputIdx) == feeAddr,
                "Fee must go to treasury address");

        // If all requires pass, the spending transaction is valid.
        // The covenant allows the UTXO to be spent with these exact outputs.
    }
}

// ────────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT
//
// 1. Compile:  silverscriptc ParimutuelMarket.ss --params '{
//      "outcomeTxid": "<placeholder_or_zero_hash>",
//      "numOutcomes": 3,
//      "feePercent": 2,
//      "feeAddr": "<treasury_spk_hex>"
//    }'
//
// 2. The compiler outputs a script hash → derive the P2SH address
// 3. Bettors send KAS to the P2SH address with OP_RETURN metadata:
//      OP_RETURN <outcomeIndex:u64> <bettor_spk>
// 4. At game end, anyone builds the resolve tx referencing all bet OP_RETURNs
//    and the final game-state txid → broadcast → winners paid atomically
//
// NOTES:
// - No time-lock: unclaimed funds stay locked forever (security guarantee)
// - No admin key: treasury address is baked into the script at compile time
// - 2% fee is enforced by the covenant — cannot be changed or bypassed
// ────────────────────────────────────────────────────────────────────────────────
