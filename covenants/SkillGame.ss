// SkillGame.ss — Winner-Takes-All Covenant for Kaspa
// High Table Protocol
//
// Settlement paths:
//   PATH A: both players sign — trustless mutual, no arbiter needed
//   PATH B: HTP_ARBITER + winner sign — opens 2-day dispute window
//   PATH C: HTP_GUARDIAN force-settles after 3-day GUARDIAN_WINDOW
//
// HTP_ARBITER:  HTP relay server — signs outcomes, co-required for PATH B
// HTP_GUARDIAN: Protocol governance — force-settles disputes (PATH C)
// For TN12: both ARBITER and GUARDIAN use the same address
//
// Verified opcodes:
//   OP_TXID()           — bind transaction
//   OP_UTXOAMOUNT()     — read UTXO amount from OutPoint
//   OP_COVENANTCOUNT()  — verify output count
//   OP_OUTPOINT_SELF()  — reference own UTXO
//   OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT()) — block height
//   checkSig()          — signature verification
//   .toScript()         — address -> script
//   outputs.push()      — construct output
//   emit Event()        — emit event

contract SkillGame(
    gameId: Hash,              // Unique game identifier
    creator: Address,          // Creator's address
    stake: u64,                // Stake per player in sompi
    network: u64               // 0 = mainnet, 1 = testnet12
) {

    // ── Constants ──────────────────────────────────────────────────
    const MAINNET_TREASURY: Address = kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel;
    const TESTNET_TREASURY: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;

    // HTP_ARBITER: relay server address (same for TN12 mainnet/guardian)
    const HTP_ARBITER: Address = kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj;
    const HTP_GUARDIAN: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;

    // Protocol fee: 2% (200 basis points)
    const FEE_BPS: u64 = 200u64;
    const FEE_DENOMINATOR: u64 = 10000u64;

    // Time windows (in blocks, ~1 block/sec on TN12)
    const DISPUTE_WINDOW: u64  = 172800u64;   // 2 days
    const GUARDIAN_WINDOW: u64 = 259200u64;   // 3 days
    const TIMEOUT_BLOCKS: u64  = 604800u64;   // 7 days

    // Minimum stake: 1 KAS in sompi
    const MIN_STAKE: u64 = 100000000u64;

    // ── Status constants ───────────────────────────────────────────
    const STATUS_OPEN: u64            = 0u64;
    const STATUS_ACTIVE: u64          = 1u64;
    const STATUS_PENDING_SETTLE: u64  = 2u64;
    const STATUS_SETTLED: u64         = 3u64;
    const STATUS_DISPUTED: u64        = 4u64;
    const STATUS_CANCELLED: u64       = 5u64;
    const STATUS_FORFEIT: u64         = 6u64;
    const STATUS_TIMEOUT: u64         = 7u64;

    // ── State ──────────────────────────────────────────────────────
    state {
        opponent: Address,          // Opponent's address
        hasOpponent: bool,          // True after opponent joined
        winner: Address,            // Winner's address
        status: u64,                // Current game status
        proposedWinner: Address,    // Winner proposed by arbiter (PATH B)
        proposedAt: u64,            // Block when proposeSettle called
        disputedAt: u64,            // Block when challenge filed
        createdBlock: u64           // Block DAA score at creation (for timeout)
    }

    // ── Join Proof ─────────────────────────────────────────────────
    struct JoinProof {
        opponentAddr: Address,        // Opponent's address
        opponentOutpoint: OutPoint    // Opponent's UTXO containing their stake
    }

    // ── ProposeSettle Proof ────────────────────────────────────────
    struct ProposeSettleProof {
        winner: Address,              // Winning player
        proofRoot: Hash,              // SHA-256 sequential-chain root
        settlementPath: u64           // 0=PATH_A, 1=PATH_B
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Join Game
    // ═══════════════════════════════════════════════════════════════
    entrypoint function join(proof: JoinProof, opponentSig: Sig) {
        require(state.status == STATUS_OPEN, "Game is not open");
        require(!state.hasOpponent, "Opponent already joined");
        require(proof.opponentAddr != creator, "Cannot join your own game");
        require(stake >= MIN_STAKE, "Stake below minimum");
        require(checkSig(opponentSig, proof.opponentAddr), "Invalid opponent signature");

        let utxoAmount = OP_UTXOAMOUNT(proof.opponentOutpoint);
        require(utxoAmount == stake, "Opponent stake amount mismatch");

        state.opponent = proof.opponentAddr;
        state.hasOpponent = true;
        state.status = STATUS_ACTIVE;
        state.createdBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());

        require(OP_COVENANTCOUNT() == 1u64, "Join must produce single covenant output");
        emit Event("GAME_JOINED", gameId, proof.opponentAddr, stake);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Propose Settlement (replaces old resolve)
    // Funds stay locked until finalizeSettle or guardianSettle.
    // ═══════════════════════════════════════════════════════════════
    entrypoint function proposeSettle(
        proof: ProposeSettleProof,
        sig1: Sig,
        sig2: Sig
    ) {
        require(state.status == STATUS_ACTIVE, "Game must be active");

        // Winner must be a player
        require(proof.winner == creator || proof.winner == state.opponent, "Winner must be a player");

        // PATH A: both players sign (trustless)
        let pathA = checkSig(sig1, creator) && checkSig(sig2, state.opponent);
        // PATH B: HTP_ARBITER + winner sign
        let pathB = checkSig(sig1, HTP_ARBITER) && checkSig(sig2, proof.winner);

        require(pathA || pathB, "Need: (both players) OR (HTP_ARBITER + winner)");

        state.proposedWinner = proof.winner;
        state.proposedAt = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        state.status = STATUS_PENDING_SETTLE;

        // Keep funds locked — no payout yet
        require(OP_COVENANTCOUNT() == 1u64, "Propose must keep funds locked in single covenant output");
        emit Event("SETTLE_PROPOSED", gameId, proof.winner, state.proposedAt);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Finalize Settlement (after dispute window)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function finalizeSettle(winnerSig: Sig) {
        require(state.status == STATUS_PENDING_SETTLE, "No pending settlement");

        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.proposedAt + DISPUTE_WINDOW, "Dispute window not closed");

        require(checkSig(winnerSig, state.proposedWinner), "Invalid winner signature");

        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let totalStake = stake * 2u64;
        let protocolFee = (totalStake * FEE_BPS) / FEE_DENOMINATOR;
        let winnerPayout = totalStake - protocolFee;
        require(winnerPayout > 0u64, "Payout underflow");

        outputs.push({script: state.proposedWinner.toScript(), amount: winnerPayout});
        outputs.push({script: treasury.toScript(), amount: protocolFee});

        state.winner = state.proposedWinner;
        state.status = STATUS_SETTLED;

        require(OP_COVENANTCOUNT() == 2u64, "Finalize must produce 2 outputs");
        emit Event("GAME_SETTLED", gameId, state.proposedWinner, winnerPayout, protocolFee);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Challenge Settlement
    // Loser can freeze funds during dispute window.
    // ═══════════════════════════════════════════════════════════════
    entrypoint function challengeSettle(challengerSig: Sig) {
        require(state.status == STATUS_PENDING_SETTLE, "No pending settlement");

        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock < state.proposedAt + DISPUTE_WINDOW, "Dispute window closed");

        let loser: Address = (state.proposedWinner == creator) ? state.opponent : creator;
        require(checkSig(challengerSig, loser), "Only loser can challenge");

        state.disputedAt = currentBlock;
        state.status = STATUS_DISPUTED;

        require(OP_COVENANTCOUNT() == 1u64, "Challenge keeps funds locked");
        emit Event("SETTLE_CHALLENGED", gameId, state.proposedWinner, loser);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Guardian Settlement
    // HTP_GUARDIAN force-settles after GUARDIAN_WINDOW if disputed.
    // ═══════════════════════════════════════════════════════════════
    entrypoint function guardianSettle(
        guardianSig: Sig,
        forcedWinner: Address,
        doSplit: bool
    ) {
        require(state.status == STATUS_DISPUTED, "Not in dispute");

        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.disputedAt + GUARDIAN_WINDOW, "Guardian window not open");

        require(checkSig(guardianSig, HTP_GUARDIAN), "Invalid guardian signature");

        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
        let protocolFee = (pool * FEE_BPS) / FEE_DENOMINATOR;

        if (doSplit) {
            // Even split: half to each player, no protocol fee
            let half = pool / 2u64;
            outputs.push({script: creator.toScript(), amount: half});
            outputs.push({script: state.opponent.toScript(), amount: half});
        } else {
            let payout = pool - protocolFee;
            require(payout > 0u64, "Payout underflow");
            outputs.push({script: forcedWinner.toScript(), amount: payout});
            outputs.push({script: treasury.toScript(), amount: protocolFee});
        }

        state.winner = forcedWinner;
        state.status = STATUS_SETTLED;

        emit Event("GUARDIAN_SETTLED", gameId, forcedWinner, doSplit);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Cancel
    // ═══════════════════════════════════════════════════════════════
    entrypoint function cancel(creatorSig: Sig) {
        require(state.status == STATUS_OPEN, "Can only cancel open games");
        require(!state.hasOpponent, "Cannot cancel after opponent joined");
        require(checkSig(creatorSig, creator), "Only creator can cancel");

        outputs.push({script: creator.toScript(), amount: stake});
        state.status = STATUS_CANCELLED;

        require(OP_COVENANTCOUNT() == 1u64, "Cancel must produce single output");
        emit Event("GAME_CANCELLED", gameId, creator, stake);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Forfeit
    // ═══════════════════════════════════════════════════════════════
    entrypoint function forfeit(forfeiterAddr: Address, forfeiterSig: Sig) {
        require(state.status == STATUS_ACTIVE, "Can only forfeit active games");
        require(forfeiterAddr == creator || forfeiterAddr == state.opponent, "Forfeiter must be a player");
        require(checkSig(forfeiterSig, forfeiterAddr), "Invalid forfeiter signature");

        let winnerAddr: Address = (forfeiterAddr == creator) ? state.opponent : creator;
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

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
    entrypoint function timeoutClaim(creatorSig: Sig) {
        let isOpen = (state.status == STATUS_OPEN);
        let isActive = (state.status == STATUS_ACTIVE);
        require(isOpen || isActive, "Game already resolved");

        require(checkSig(creatorSig, creator), "Only creator can claim timeout");

        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.createdBlock + TIMEOUT_BLOCKS, "Timeout not reached");

        outputs.push({script: creator.toScript(), amount: stake});
        if (state.hasOpponent && isActive) {
            outputs.push({script: state.opponent.toScript(), amount: stake});
        }

        state.status = STATUS_TIMEOUT;
        emit Event("GAME_TIMEOUT", gameId, creator, stake);
    }
}
