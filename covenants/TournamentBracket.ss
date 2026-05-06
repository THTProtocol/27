// TournamentBracket.ss — HTP Tournament Covenant
// Kaspa TN12 — Silverscript
//
// 8-player single elimination bracket. Each match is a covenant UTXO.
// Settlement paths:
//   PATH A: both match players sign — advance round trustlessly
//   PATH B: HTP_ARBITER + winner sign — opens 2-day dispute window
//   PATH C: HTP_GUARDIAN force-advances after 3-day GUARDIAN_WINDOW
//
// HTP_ARBITER:  HTP relay server — signs outcomes
// HTP_GUARDIAN: Protocol governance — force-settles disputes

contract TournamentBracket(
    tournamentId: Hash,          // Unique tournament identifier
    round: u64,                  // 0=QF, 1=SF, 2=Final
    player1: Address,            // First player's address
    player2: Address,            // Second player's address
    entryFee: u64,               // Entry fee per player in sompi
    network: u64                 // 0=mainnet, 1=testnet12
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
        status: u64,               // 0=waiting,1=active,2=pending,3=complete,4=disputed,5=forfeit,6=timeout
        winner: Address,
        proposedWinner: Address,
        proposedAt: u64,
        disputedAt: u64,
        createdBlock: u64
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Propose Advance
    // ═══════════════════════════════════════════════════════════════
    entrypoint function proposeAdvance(winnerAddr: Address, sig1: Sig, sig2: Sig) {
        require(state.status == 1u64, "Match is not active");
        require(winnerAddr == player1 || winnerAddr == player2, "Winner must be a participant");

        let pathA = checkSig(sig1, player1) && checkSig(sig2, player2);
        let pathB = checkSig(sig1, HTP_ARBITER) && checkSig(sig2, winnerAddr);
        require(pathA || pathB, "Need: (both players) OR (HTP_ARBITER + winner)");

        state.proposedWinner = winnerAddr;
        state.proposedAt = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        state.status = 2u64; // PENDING

        require(OP_COVENANTCOUNT() == 1u64, "Propose keeps funds locked");
        emit Event("ADVANCE_PROPOSED", tournamentId, round, winnerAddr);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Finalize Advance (after dispute window)
    // ═══════════════════════════════════════════════════════════════
    entrypoint function finalizeAdvance(winnerSig: Sig) {
        require(state.status == 2u64, "No pending advance");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.proposedAt + DISPUTE_WINDOW, "Dispute window not closed");
        require(checkSig(winnerSig, state.proposedWinner), "Invalid winner signature");

        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());

        if (round == 2u64) {
            let fee = (pool * FEE_BPS) / FEE_DENOMINATOR;
            let payout = pool - fee;
            require(payout > 0u64, "Payout underflow");
            outputs.push({script: state.proposedWinner.toScript(), amount: payout});
            outputs.push({script: treasury.toScript(), amount: fee});
            require(OP_COVENANTCOUNT() == 2u64, "Final: 2 outputs");
            emit Event("CHAMPION", tournamentId, state.proposedWinner, payout, fee);
        } else {
            require(OP_COVENANTCOUNT() == 1u64, "Advance: 1 covenant output");
            emit Event("ROUND_ADVANCED", tournamentId, round, state.proposedWinner);
        }

        state.winner = state.proposedWinner;
        state.status = 3u64;
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Challenge Advance
    // ═══════════════════════════════════════════════════════════════
    entrypoint function challengeAdvance(challengerSig: Sig) {
        require(state.status == 2u64, "No pending advance");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock < state.proposedAt + DISPUTE_WINDOW, "Dispute window closed");

        let loser: Address = (state.proposedWinner == player1) ? player2 : player1;
        require(checkSig(challengerSig, loser), "Only loser can challenge");

        state.disputedAt = currentBlock;
        state.status = 4u64; // DISPUTED
        require(OP_COVENANTCOUNT() == 1u64, "Challenge keeps funds locked");
        emit Event("ADVANCE_CHALLENGED", tournamentId, round, loser);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Guardian Advance
    // ═══════════════════════════════════════════════════════════════
    entrypoint function guardianAdvance(guardianSig: Sig, forcedWinner: Address, doSplit: bool) {
        require(state.status == 4u64, "Not in dispute");
        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.disputedAt + GUARDIAN_WINDOW, "Guardian window not open");
        require(checkSig(guardianSig, HTP_GUARDIAN), "Invalid guardian signature");

        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        if (round == 2u64) {
            let fee = (pool * FEE_BPS) / FEE_DENOMINATOR;
            if (doSplit) {
                let half = pool / 2u64;
                outputs.push({script: player1.toScript(), amount: half});
                outputs.push({script: player2.toScript(), amount: half});
            } else {
                let payout = pool - fee;
                outputs.push({script: forcedWinner.toScript(), amount: payout});
                outputs.push({script: treasury.toScript(), amount: fee});
            }
        } else {
            require(OP_COVENANTCOUNT() == 1u64, "Guardian advance: 1 output");
        }

        state.winner = forcedWinner;
        state.status = 3u64;
        emit Event("GUARDIAN_ADVANCED", tournamentId, round, forcedWinner, doSplit);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Forfeit
    // ═══════════════════════════════════════════════════════════════
    entrypoint function forfeit(forfeiterAddr: Address, forfeiterSig: Sig) {
        require(state.status == 1u64, "Match is not active");
        require(forfeiterAddr == player1 || forfeiterAddr == player2, "Forfeiter must be a participant");
        require(checkSig(forfeiterSig, forfeiterAddr), "Invalid signature");

        let winner: Address = (forfeiterAddr == player1) ? player2 : player1;
        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        if (round == 2u64) {
            let fee = (pool * FEE_BPS) / FEE_DENOMINATOR;
            let payout = pool - fee;
            outputs.push({script: winner.toScript(), amount: payout});
            outputs.push({script: treasury.toScript(), amount: fee});
            require(OP_COVENANTCOUNT() == 2u64, "Final: 2 outputs");
        } else {
            require(OP_COVENANTCOUNT() == 1u64, "Advance: 1 output");
        }

        state.winner = winner;
        state.status = 5u64;
        emit Event("MATCH_FORFEIT", tournamentId, round, forfeiterAddr, winner);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Timeout
    // ═══════════════════════════════════════════════════════════════
    entrypoint function timeout(claimantAddr: Address, claimantSig: Sig) {
        require(state.status == 1u64, "Match is not active");
        require(claimantAddr == player1 || claimantAddr == player2, "Claimant must be a participant");
        require(checkSig(claimantSig, claimantAddr), "Invalid signature");

        let currentBlock = OP_TXINPUTBLOCKDAASCORE(OP_COVENANTCOUNT());
        require(currentBlock >= state.createdBlock + TIMEOUT_BLOCKS, "Timeout not reached");

        outputs.push({script: player1.toScript(), amount: entryFee});
        outputs.push({script: player2.toScript(), amount: entryFee});
        state.status = 6u64;
        emit Event("MATCH_TIMEOUT", tournamentId, round, claimantAddr);
    }
}
