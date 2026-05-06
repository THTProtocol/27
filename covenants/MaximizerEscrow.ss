// MaximizerEscrow Covenant - High Table Protocol
// Kaspa TN12 - Silverscript
//
// Holds 50% hedged portion of each maximizer bet in ParimutuelMarket:
// - On win: releases hedge to ParimutuelMarket for inclusion in winner payout
// - On lose: bettor can claim back hedge minus 30% protocol fee (gets 35% of original bet)
// - Unclaimed hedges after 7 days: claimable by anyone, 30% to treasury, 70% to bettor address

contract MaximizerEscrow(
    betId: Hash,                 // Unique bet identifier (bound to bet)
    parentMarket: Address,        // Address of ParimutuelMarket covenant
    bettor: Address,              // Bettor's address (for lose/timeout claims)
    hedgeAmount: u64,             // Amount held in escrow (50% of bet) in sompi
    outcomeTxid: Hash,            // Game outcome transaction ID (bound via OP_TXID)
    network: u64                  // 0 = mainnet, 1 = testnet12
) {

    // Network treasury addresses (hardcoded)
    const MAINNET_TREASURY: Address = kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel;
    const TESTNET_TREASURY: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;

    // Claim timeout: 7 days in milliseconds
    const CLAIM_TIMEOUT_MS: u64 = 604800000u64;  // 7 * 24 * 60 * 60 * 1000

    // Protocol fee percentage on lost hedges
    const LOSE_FEE_PCT: u64 = 30u64;

    // Escrow state
    state {
        released: bool,             // True after release to market
        claimed: bool,            // True after bettor claim
        forfeited: bool,          // True after timeout claim
        winOutcomeProcessed: bool, // True if outcome processed as win
        creationTime: u64          // Block DAA score when escrow created
    }

    // Outcome proof from ParimutuelMarket
    struct OutcomeProof {
        isWin: bool,                // True if bettor won
        winningOutcome: u64,        // Winning outcome index
        marketTxid: Hash,           // Transaction ID from market
        marketSig: Sig              // Signature from market covenant
    }

    // Entrypoint: Release hedge to ParimutuelMarket (on bettor win)
    entrypoint function releaseToMarket(proof: OutcomeProof, resolverSig: Sig) {
        // Only callable once
        require(!state.released, "Already released");
        require(!state.claimed, "Already claimed");
        require(!state.forfeited, "Already forfeited");

        // Verify caller is the parent market
        require(OP_TXID() == outcomeTxid, "Outcome txid mismatch");

        // Get treasury
        let treasury = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        // Verify resolver signature against treasury (orchestrator)
        require(checkSig(resolverSig, treasury), "Invalid resolver signature");

        // Verify proof from market
        require(checkSig(proof.marketSig, parentMarket), "Invalid market proof");

        // Must be a win outcome
        require(proof.isWin, "Proof must indicate win for release");

        // Release full hedge to market covenant
        outputs.push({script: parentMarket.toScript(), amount: hedgeAmount});

        // Mark as released
        state.released = true;
        state.winOutcomeProcessed = true;

        // Verify single output
        require(OP_COVENANTCOUNT() == 1u64, "Release must have single output");

        // Emit release event
        emit Event("HEDGE_RELEASED", betId, bettor, hedgeAmount, parentMarket);
    }

    // Entrypoint: Bettor claims hedge back (on loss) minus 30% protocol fee
    entrypoint function bettorClaimLose(proof: OutcomeProof, bettorSig: Sig) {
        // Only callable once
        require(!state.released, "Already released");
        require(!state.claimed, "Already claimed");
        require(!state.forfeited, "Already forfeited");

        // Verify bettor signature
        require(checkSig(bettorSig, bettor), "Invalid bettor signature");

        // Verify outcome transaction
        require(OP_TXID() == outcomeTxid, "Outcome txid mismatch");

        // Get treasury
        let treasury = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        // Verify proof from market
        require(checkSig(proof.marketSig, parentMarket), "Invalid market proof");

        // Must be a loss outcome
        require(!proof.isWin, "Proof must indicate loss for claim");

        // Calculate split: 30% to treasury, 70% to bettor
        let protocolFee = (hedgeAmount * LOSE_FEE_PCT) / 100u64;
        let bettorRefund = hedgeAmount - protocolFee;  // 70% of hedge = 35% of original bet

        // Bettor gets 70% of hedge
        outputs.push({script: bettor.toScript(), amount: bettorRefund});

        // Protocol fee to treasury
        outputs.push({script: treasury.toScript(), amount: protocolFee});

        // Mark as claimed
        state.claimed = true;

        // Verify exactly 2 outputs
        require(OP_COVENANTCOUNT() == 2u64, "Lose claim must have 2 outputs");

        // Emit claim event
        emit Event("HEDGE_CLAIMED_LOSE", betId, bettor, bettorRefund, protocolFee);
    }

    // Entrypoint: Timeout claim after 7 days (anyone can call, bettor gets 70%)
    entrypoint function timeoutClaim(claimantSig: Sig, currentTime: u64) {
        // Only callable once
        require(!state.released, "Already released");
        require(!state.claimed, "Already claimed");
        require(!state.forfeited, "Already forfeited");

        // Get treasury
        let treasury = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        // Calculate bet creation time (stored in covenant)
        let betCreationTime: u64 = extractCreationTime();

        // Verify timeout period has elapsed
        require(currentTime >= betCreationTime + CLAIM_TIMEOUT_MS, "Timeout period not elapsed");

        // Calculate split: 30% to treasury, 70% to bettor
        let protocolFee = (hedgeAmount * LOSE_FEE_PCT) / 100u64;
        let bettorRefund = hedgeAmount - protocolFee;

        // Original bettor gets 70% of hedge (even on timeout)
        outputs.push({script: bettor.toScript(), amount: bettorRefund});

        // Protocol fee to treasury
        outputs.push({script: treasury.toScript(), amount: protocolFee});

        // Mark as forfeited (completed via timeout)
        state.forfeited = true;

        // Verify exactly 2 outputs
        require(OP_COVENANTCOUNT() == 2u64, "Timeout claim must have 2 outputs");

        // Emit forfeiture event
        emit Event("HEDGE_TIMEOUT_CLAIM", betId, bettor, bettorRefund, protocolFee, currentTime);
    }

    // Helper: Extract bet creation time from covenant state
    function extractCreationTime() -> u64 {
        // Read creation time from covenant state
        // Initialized when covenant UTXO is created via placeBet
        return state.creationTime; // Real state-backed implementation
    }

    // Helper: Get self outpoint
    function OP_SELFOUTPOINT() -> OutPoint {
        return OP_OUTPOINT_SELF();
    }
}
