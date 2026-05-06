// MaximizerEscrow.ss — HTP Maximizer Hedge Escrow Covenant
// Kaspa TN12 — Silverscript
//
// Holds 50% hedged portion of maximizer bets from ParimutuelMarket.
// Settlement paths:
//   PATH A: HTP_ARBITER + market co-sign — release hedge to market
//   PATH B: Bettor claims (loss) — receives 70% of hedge after window
//   PATH C: HTP_GUARDIAN force-settles if disputed
//
// HTP_ARBITER:  HTP relay server
// HTP_GUARDIAN: Protocol governance

contract MaximizerEscrow(
    betId: Hash,                 // Unique bet identifier
    parentMarket: Address,        // ParimutuelMarket covenant address
    bettor: Address,              // Bettor's address (for lose/timeout)
    hedgeAmount: u64,             // Amount held in escrow (50% of bet)
    outcomeTxid: Hash,            // Game outcome TXID (via OP_TXID)
    network: u64                  // 0=mainnet, 1=testnet12
) {

    const MAINNET_TREASURY: Address = kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel;
    const TESTNET_TREASURY: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;
    const HTP_ARBITER: Address = kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj;
    const HTP_GUARDIAN: Address = kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj;
    const FEE_BPS: u64 = 200u64;
    const FEE_DENOMINATOR: u64 = 10000u64;
    const DISPUTE_WINDOW: u64  = 172800u64;
    const GUARDIAN_WINDOW: u64 = 259200u64;
    const TIMEOUT_BLOCKS: u64  = 604800u64;

    state {
        released: bool,
        claimed: bool,
        forfeited: bool,
        disputed: bool,
        winOutcomeProcessed: bool,
        proposedAt: u64,
        disputedAt: u64,
        createdBlock: u64
    }

    struct OutcomeProof {
        isWin: bool,
        winningOutcome: u64,
        marketTxid: Hash,
        marketSig: Sig
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Propose Release to Market (arbiter + market co-sign)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function proposeRelease(
        proof: OutcomeProof,
        arbiterSig: Sig,
        marketSig: Sig
    ) {
        require(!state.released && !state.claimed && !state.forfeited, "Already processed");
        require(OP_TXID() == outcomeTxid, "Outcome txid mismatch");
        require(proof.isWin, "Must indicate win for release");
        require(checkSig(arbiterSig, HTP_ARBITER), "Invalid arbiter signature");
        require(checkSig(marketSig, parentMarket), "Invalid market proof");

        state.proposedAt = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        state.winOutcomeProcessed = true;

        require(OP_COVENANTCOUNT() == 1u64, "Propose keeps funds locked");
        emit Event("RELEASE_PROPOSED", betId, bettor, hedgeAmount);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Finalize Release (after dispute window)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function finalizeRelease(marketSig: Sig) {
        require(state.winOutcomeProcessed && !state.released, "No pending release");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.proposedAt + DISPUTE_WINDOW, "Dispute window not closed");
        require(checkSig(marketSig, parentMarket), "Invalid market signature");

        outputs.push({script: parentMarket.toScript(), amount: hedgeAmount});
        state.released = true;

        require(OP_COVENANTCOUNT() == 1u64, "Release must have single output");
        emit Event("HEDGE_RELEASED", betId, bettor, hedgeAmount, parentMarket);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Bettor Claim Loss (70% of hedge)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function bettorClaimLose(bettorSig: Sig) {
        require(!state.released && !state.claimed && !state.forfeited, "Already processed");
        require(!state.winOutcomeProcessed, "Outcome already processed");
        require(checkSig(bettorSig, bettor), "Invalid bettor signature");

        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.createdBlock + DISPUTE_WINDOW, "Must wait dispute window");

        // Bettor gets 70% of hedge, treasury gets 30%
        let protocolFee = (hedgeAmount * 30u64) / 100u64;
        let refund = hedgeAmount - protocolFee;

        outputs.push({script: bettor.toScript(), amount: refund});
        outputs.push({script: treasury.toScript(), amount: protocolFee});
        state.claimed = true;

        require(OP_COVENANTCOUNT() == 2u64, "Claim must have 2 outputs");
        emit Event("HEDGE_CLAIMED_LOSE", betId, bettor, refund, protocolFee);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Challenge Release
    // ═══════════════════════════════════════════════════════════════
    entrypoint function challengeRelease(challengerSig: Sig) {
        require(state.winOutcomeProcessed && !state.released, "No pending release");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock < state.proposedAt + DISPUTE_WINDOW, "Dispute window closed");
        require(checkSig(challengerSig, bettor), "Only bettor can challenge");

        state.disputedAt = currentBlock;
        state.disputed = true;
        require(OP_COVENANTCOUNT() == 1u64, "Challenge keeps funds locked");
        emit Event("RELEASE_CHALLENGED", betId, bettor);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Guardian Settlement
    // ═══════════════════════════════════════════════════════════════
    entrypoint function guardianSettle(guardianSig: Sig, doRelease: bool) {
        require(state.disputed, "Not in dispute");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.disputedAt + GUARDIAN_WINDOW, "Guardian window not open");
        require(checkSig(guardianSig, HTP_GUARDIAN), "Invalid guardian signature");

        if (doRelease) {
            outputs.push({script: parentMarket.toScript(), amount: hedgeAmount});
            state.released = true;
        } else {
            let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
            let protocolFee = (hedgeAmount * 30u64) / 100u64;
            let refund = hedgeAmount - protocolFee;
            outputs.push({script: bettor.toScript(), amount: refund});
            outputs.push({script: treasury.toScript(), amount: protocolFee});
            state.claimed = true;
        }

        require(OP_COVENANTCOUNT() == 1u64, "Guardian settle: 1 output");
        emit Event("GUARDIAN_SETTLED", betId, bettor, doRelease);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Timeout Claim
    // ═══════════════════════════════════════════════════════════════
    entrypoint function timeoutClaim(claimantSig: Sig) {
        require(!state.released && !state.claimed && !state.forfeited, "Already processed");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.createdBlock + TIMEOUT_BLOCKS, "Timeout not reached");

        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let protocolFee = (hedgeAmount * 30u64) / 100u64;
        let refund = hedgeAmount - protocolFee;
        outputs.push({script: bettor.toScript(), amount: refund});
        outputs.push({script: treasury.toScript(), amount: protocolFee});
        state.forfeited = true;

        require(OP_COVENANTCOUNT() == 2u64, "Timeout must have 2 outputs");
        emit Event("HEDGE_TIMEOUT", betId, bettor, refund, protocolFee);
    }
}
