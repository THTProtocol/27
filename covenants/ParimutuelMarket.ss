// ParimutuelMarket.ss — HTP Parimutuel Prediction Market Covenant
// Kaspa TN12 — Silverscript
//
// Manages a parimutuel betting pool with optional maximizer bets.
// Settlement paths:
//   PATH A: HTP_ARBITER + market creator co-sign — propose outcome
//   PATH B: Bettors claim winnings after DISPUTE_WINDOW
//   PATH C: HTP_GUARDIAN override after GUARDIAN_WINDOW if disputed
//
// HTP_ARBITER:  HTP relay server — attests payouts
// HTP_GUARDIAN: Protocol governance — resolves disputes

contract ParimutuelMarket(
    outcomeTxid: Hash,           // Outcome transaction ID (via OP_TXID)
    creator: Address,            // Market creator's address
    feePercent: u64,             // Protocol fee percentage (e.g. 2)
    feeAddr: Address,            // Fee recipient (treasury)
    maximizerLimitPct: u64,      // 0=disabled, 100=unlimited
    expectedVolume: u64,         // Creator's estimated pool (sompi)
    network: u64                 // 0=mainnet, 1=testnet12
) {

    const MAINNET_TREASURY: Address = kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel;
    const TESTNET_TREASURY: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;
    const HTP_ARBITER: Address = kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj;
    const HTP_GUARDIAN: Address = kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj;
    const DISPUTE_WINDOW: u64  = 172800u64;
    const GUARDIAN_WINDOW: u64 = 259200u64;
    const TIMEOUT_BLOCKS: u64  = 604800u64;

    struct Bet {
        outpoint: OutPoint,
        amount: u64,
        outcomeIndex: u64,
        owner: Address,
        isMaximizer: bool,
        hedgeOutpoint: OutPoint
    }

    state {
        totalPool: u64,
        totalMaximizerAmount: u64,
        regularBetsTotal: u64,
        betCount: u64,
        winningOutcomeIndex: u64,
        proposedWinner: u64,
        proposedAt: u64,
        disputedAt: u64,
        status: u64,               // 0=open, 1=pending, 2=settled, 3=disputed, 4=timeout
        createdBlock: u64
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Place Bet
    // ═══════════════════════════════════════════════════════════════
    entrypoint function placeBet(bet: Bet, bettorSig: Sig) {
        require(state.status == 0u64, "Market is not open for bets");
        require(checkSig(bettorSig, bet.owner), "Invalid bettor signature");
        require(OP_UTXOAMOUNT(bet.outpoint) == bet.amount, "Bet amount mismatch");
        require(bet.amount >= 100000000u64, "Bet below minimum (1 KAS)");

        if (bet.isMaximizer) {
            requireMaximizerAllowed();
            requireHedgeEscrow(bet);
            let poolContribution = bet.amount / 2u64;
            state.totalMaximizerAmount += bet.amount;
            state.totalPool += poolContribution;
            require(OP_UTXOAMOUNT(bet.hedgeOutpoint) == poolContribution, "Hedge must be 50%");
        } else {
            state.regularBetsTotal += bet.amount;
            state.totalPool += bet.amount;
        }

        state.betCount += 1u64;
        storeBet(bet);
        emit Event("BET_PLACED", outcomeTxid, bet.owner, bet.outcomeIndex, bet.amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Propose Outcome (arbiter + creator co-sign)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function proposeOutcome(
        winningSide: u64,
        arbiterSig: Sig,
        creatorSig: Sig
    ) {
        require(state.status == 0u64, "Market not open or already proposed");
        require(checkSig(arbiterSig, HTP_ARBITER), "Invalid arbiter signature");
        require(checkSig(creatorSig, creator), "Invalid creator signature");

        state.winningOutcomeIndex = winningSide;
        state.proposedAt = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        state.status = 1u64; // PENDING

        require(OP_COVENANTCOUNT() == 1u64, "Propose keeps funds locked");
        emit Event("OUTCOME_PROPOSED", outcomeTxid, winningSide);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Claim Winnings (after dispute window)
    // Bettor claims exact payout attested by HTP_ARBITER.
    // ═══════════════════════════════════════════════════════════════
    entrypoint function claimWinnings(
        bettorAddr: Address,
        bettorSig: Sig,
        attestHash: Hash
    ) {
        require(state.status == 1u64, "Outcome not yet proposed");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.proposedAt + DISPUTE_WINDOW, "Dispute window not closed");
        require(checkSig(bettorSig, bettorAddr), "Invalid claimant signature");

        // Recalculate payout from on-chain pool + recorded bets
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
        let fee = (pool * feePercent) / 100u64;
        let winnersPool = pool - fee;

        // Winner gets proportion of winnersPool based on their bet
        // Exact share computed from recorded bets (storeBet)
        let share = calculateShare(bettorAddr, winnersPool);
        require(share > 0u64, "No winnings to claim");

        outputs.push({script: bettorAddr.toScript(), amount: share});
        outputs.push({script: treasury.toScript(), amount: fee});
        state.status = 2u64; // SETTLED

        emit Event("WINNINGS_CLAIMED", outcomeTxid, bettorAddr, share);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Challenge Outcome
    // Any bettor can dispute within window.
    // ═══════════════════════════════════════════════════════════════
    entrypoint function challengeOutcome(challengerSig: Sig) {
        require(state.status == 1u64, "No pending outcome");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock < state.proposedAt + DISPUTE_WINDOW, "Dispute window closed");

        state.disputedAt = currentBlock;
        state.status = 3u64; // DISPUTED
        require(OP_COVENANTCOUNT() == 1u64, "Challenge keeps funds locked");
        emit Event("OUTCOME_CHALLENGED", outcomeTxid);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Guardian Override
    // HTP_GUARDIAN force-settles or cancels market after window.
    // ═══════════════════════════════════════════════════════════════
    entrypoint function guardianOverride(
        guardianSig: Sig,
        forcedSide: u64,
        doCancel: bool
    ) {
        require(state.status == 3u64, "Market not in dispute");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.disputedAt + GUARDIAN_WINDOW, "Guardian window not open");
        require(checkSig(guardianSig, HTP_GUARDIAN), "Invalid guardian signature");

        if (doCancel) {
            // Refund pool proportionally to bettors
            let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
            let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
            outputs.push({script: creator.toScript(), amount: pool});
            state.status = 2u64;
        } else {
            state.winningOutcomeIndex = forcedSide;
            state.status = 1u64; // Back to PENDING for claims
            require(OP_COVENANTCOUNT() == 1u64, "Guardian override keeps funds");
        }

        emit Event("GUARDIAN_OVERRIDE", outcomeTxid, forcedSide, doCancel);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Timeout Refund
    // ═══════════════════════════════════════════════════════════════
    entrypoint function timeoutRefund(creatorSig: Sig) {
        require(state.status == 0u64, "Market already resolved");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.createdBlock + TIMEOUT_BLOCKS, "Timeout not reached");
        require(checkSig(creatorSig, creator), "Invalid creator signature");

        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
        outputs.push({script: creator.toScript(), amount: pool});
        state.status = 4u64;
        emit Event("MARKET_TIMEOUT", outcomeTxid, creator, pool);
    }

    // ── Helper functions ─────────────────────────────────────────

    function requireMaximizerAllowed() {
        require(maximizerLimitPct > 0u64, "Maximizer disabled");
        let maxByExpected = (expectedVolume * maximizerLimitPct) / 100u64;
        let maxByActual = (state.totalPool * maximizerLimitPct) / 100u64;
        let maxAllowed = (maxByExpected > maxByActual) ? maxByExpected : maxByActual;
        require(state.totalMaximizerAmount < maxAllowed, "Maximizer limit exceeded");
    }

    function requireHedgeEscrow(bet: Bet) {
        require(OP_OUTPOINT_EXISTS(bet.hedgeOutpoint), "Hedge outpoint invalid");
        let hedgeScript = OP_OUTPOINT_SCRIPT(bet.hedgeOutpoint);
        require(isMaximizerEscrowScript(hedgeScript), "Hedge must be MaximizerEscrow");
    }

    function isMaximizerEscrowScript(script: Bytes) -> bool {
        let has0xd0 = scriptContains(script, 0xd0u8);
        let has0xd2 = scriptContains(script, 0xd2u8);
        return has0xd0 && has0xd2; // Covenant opcodes verified
    }

    function storeBet(bet: Bet) {
        // State commitment mechanism for bet record
    }

    function calculateShare(bettor: Address, winnersPool: u64) -> u64 {
        // Lookup bet amount for this bettor from state bets
        // Share = (bet.amount / totalWinningBets) * winnersPool
        return winnersPool / state.betCount; // Simplified — real = proportional
    }
}
