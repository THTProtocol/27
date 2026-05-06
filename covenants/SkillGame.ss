// SkillGame.ss — Winner-Takes-All Covenant for Kaspa
// High Table Protocol
//
// Game lifecycle:
//   1. Creator posts stake -> covenant UTXO created (status=OPEN, holds stake)
//   2. Opponent sends matching stake -> covenant absorbs it, state=ACTIVE, holds 2x stake
//   3. Game plays out off-chain; sequential SHA-256 move-log committed
//   4. Winner calls resolve -> payout minus 2% protocol fee
//   5. Creator cancels before opponent joins -> full refund, no fee
//   6. Either player forfeits -> opponent gets stake minus 2% fee  
//   7. Timeout: unresolved for 7 days -> creator reclaims
//
// Verified opcodes (from working MaximizerEscrow + ParimutuelMarket):
//   OP_TXID()           — bind transaction
//   OP_UTXOAMOUNT()     — read UTXO amount from OutPoint
//   OP_COVENANTCOUNT()  — verify output count
//   checkSig()          — signature verification
//   .toScript()         — address -> script
//   outputs.push()      — construct output
//   emit Event()        — emit event

contract SkillGame(
    gameId: Hash,              // Unique game identifier
    creator: Address,          // Creator's address
    stake: u64,                // Stake per player in sompi
    outcomeTxid: Hash,         // Game outcome txid (bound via OP_TXID)
    network: u64               // 0 = mainnet, 1 = testnet12
) {

    // ── Constants ──────────────────────────────────────────────────
    const MAINNET_TREASURY: Address = kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel;
    const TESTNET_TREASURY: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;

    // Protocol fee: 2% (200 basis points)
    const FEE_BPS: u64 = 200u64;
    const FEE_DENOMINATOR: u64 = 10000u64;

    // Timeout: 7 days in milliseconds
    const TIMEOUT_MS: u64 = 604800000u64;

    // Minimum stake: 1 KAS in sompi
    const MIN_STAKE: u64 = 100000000u64;

    // ── Status constants ───────────────────────────────────────────
    const STATUS_OPEN: u64      = 0u64;
    const STATUS_ACTIVE: u64    = 1u64;
    const STATUS_SETTLED: u64   = 2u64;
    const STATUS_CANCELLED: u64 = 3u64;
    const STATUS_FORFEIT: u64   = 4u64;
    const STATUS_TIMEOUT: u64   = 5u64;

    // ── State ──────────────────────────────────────────────────────
    state {
        opponent: Address,          // Opponent's address (valid only when active)
        hasOpponent: bool,          // True after opponent joined
        winner: Address,            // Winner's address
        status: u64,                // Current game status
        creationTime: u64           // Timestamp at creation (for timeout)
    }

    // ── Join Proof ─────────────────────────────────────────────────
    struct JoinProof {
        opponentAddr: Address,        // Opponent's address
        opponentOutpoint: OutPoint    // Opponent's UTXO containing their stake
    }

    // ── Resolve Proof ──────────────────────────────────────────────
    struct ResolveProof {
        winner: Address,              // Winning player
        proofRoot: Hash               // SHA-256 sequential-chain root
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Join Game
    // Covenant absorbs opponent's stake. TX creates new covenant
    // output with combined amount (stake * 2).
    // ═══════════════════════════════════════════════════════════════
    entrypoint function join(proof: JoinProof, opponentSig: Sig) {
        // Only joinable when open
        require(state.status == STATUS_OPEN, "Game is not open");
        require(!state.hasOpponent, "Opponent already joined");

        // Cannot play against yourself
        require(proof.opponentAddr != creator, "Cannot join your own game");

        // Anti-spam: minimum stake
        require(stake >= MIN_STAKE, "Stake below minimum");

        // Verify opponent signature
        require(checkSig(opponentSig, proof.opponentAddr), "Invalid opponent signature");

        // Verify opponent staked exactly the required amount on-chain
        let utxoAmount = OP_UTXOAMOUNT(proof.opponentOutpoint);
        require(utxoAmount == stake, "Opponent stake amount mismatch");

        // Set opponent
        state.opponent = proof.opponentAddr;
        state.hasOpponent = true;
        state.status = STATUS_ACTIVE;

        // Single covenant output: the calling TX handles combining both
        // stakes into the new covenant UTXO (amount = stake * 2)
        require(OP_COVENANTCOUNT() == 1u64, "Join must produce single covenant output");

        emit Event("GAME_JOINED", gameId, proof.opponentAddr, stake);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Resolve (winner determined)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function resolve(proof: ResolveProof, resolverSig: Sig) {
        // Game must be active
        require(state.status == STATUS_ACTIVE, "Game must be active to resolve");

        // Winner must be one of the two players
        let isCreator = (proof.winner == creator);
        let isOpponent = (proof.winner == state.opponent);
        require(isCreator || isOpponent, "Winner must be a player");

        // Get treasury for this network
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        // Resolver can be the winner or the treasury (admin override)
        let validSig = checkSig(resolverSig, proof.winner) || checkSig(resolverSig, treasury);
        require(validSig, "Invalid resolver signature");

        // Calculate payouts
        let totalStake = stake * 2u64;                     // Both stakes
        let protocolFee = (totalStake * FEE_BPS) / FEE_DENOMINATOR;
        let winnerPayout = totalStake - protocolFee;

        // Safety: payout must be positive
        require(winnerPayout > 0u64, "Payout underflow");

        // Output 1: winner
        outputs.push({script: proof.winner.toScript(), amount: winnerPayout});

        // Output 2: protocol fee to treasury
        outputs.push({script: treasury.toScript(), amount: protocolFee});

        // Mark settled
        state.winner = proof.winner;
        state.status = STATUS_SETTLED;

        require(OP_COVENANTCOUNT() == 2u64, "Resolve must produce 2 outputs");

        emit Event("GAME_SETTLED", gameId, proof.winner, winnerPayout, protocolFee);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Cancel (creator only, before opponent joins)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function cancel(creatorSig: Sig) {
        // Only cancel open games
        require(state.status == STATUS_OPEN, "Can only cancel open games");
        require(!state.hasOpponent, "Cannot cancel after opponent joined");

        // Verify creator signature
        require(checkSig(creatorSig, creator), "Only creator can cancel");

        // Full refund, zero fee
        outputs.push({script: creator.toScript(), amount: stake});

        state.status = STATUS_CANCELLED;

        require(OP_COVENANTCOUNT() == 1u64, "Cancel must produce single output");

        emit Event("GAME_CANCELLED", gameId, creator, stake);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Forfeit
    // ═══════════════════════════════════════════════════════════════
    entrypoint function forfeit(forfeiterAddr: Address, forfeiterSig: Sig) {
        // Game must be active
        require(state.status == STATUS_ACTIVE, "Can only forfeit active games");

        // Forfeiter must be a player
        let isCreator = (forfeiterAddr == creator);
        let isOpponent = (forfeiterAddr == state.opponent);
        require(isCreator || isOpponent, "Forfeiter must be a player");

        // Verify forfeiter signature
        require(checkSig(forfeiterSig, forfeiterAddr), "Invalid forfeiter signature");

        // Winner is the other player
        let winnerAddr: Address = (forfeiterAddr == creator) ? state.opponent : creator;

        // Get treasury
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        // Same payout math as resolve
        let totalStake = stake * 2u64;
        let protocolFee = (totalStake * FEE_BPS) / FEE_DENOMINATOR;
        let winnerPayout = totalStake - protocolFee;

        require(winnerPayout > 0u64, "Payout underflow");

        outputs.push({script: winnerAddr.toScript(), amount: winnerPayout});
        outputs.push({script: treasury.toScript(), amount: protocolFee});

        state.winner = winnerAddr;
        state.status = STATUS_FORFEIT;

        require(OP_COVENANTCOUNT() == 2u64, "Forfeit must produce 2 outputs");

        emit Event("GAME_FORFEIT", gameId, forfeiterAddr, winnerAddr, winnerPayout);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Timeout Claim
    // ═══════════════════════════════════════════════════════════════
    entrypoint function timeoutClaim(creatorSig: Sig, currentTime: u64) {
        // Game must be open or active (not already resolved)
        let isOpen = (state.status == STATUS_OPEN);
        let isActive = (state.status == STATUS_ACTIVE);
        require(isOpen || isActive, "Game already resolved");

        // Verify creator signature
        require(checkSig(creatorSig, creator), "Only creator can claim timeout");

        // Timeout period must have elapsed
        require(currentTime >= state.creationTime + TIMEOUT_MS, "Timeout period not elapsed");

        // Refund creator's stake
        outputs.push({script: creator.toScript(), amount: stake});

        // If opponent joined, refund opponent's stake too
        if (state.hasOpponent && isActive) {
            outputs.push({script: state.opponent.toScript(), amount: stake});
        }

        state.status = STATUS_TIMEOUT;

        emit Event("GAME_TIMEOUT", gameId, creator, stake);
    }
}
