// TournamentBracket.ss — High Table Protocol Tournament Covenant
// Kaspa TN12 — Silverscript
//
// 8-player single elimination bracket. Each match is a covenant UTXO.
// Spending TX creates the next-round covenant UTXO for non-final rounds.
// Final round: spending TX pays champion + treasury directly.

contract TournamentBracket(
    tournamentId: Hash,          // Unique tournament identifier
    round: u64,                  // 0=QF, 1=SF, 2=Final
    player1: Address,            // First player's address
    player2: Address,            // Second player's address
    entryFee: u64,               // Entry fee per player in sompi
    network: u64                 // 0=mainnet, 1=testnet12
) {

    // ── Constants ──────────────────────────────────────────────────
    const MAINNET_TREASURY: Address = kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel;
    const TESTNET_TREASURY: Address = kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m;
    const FEE_BPS: u64 = 200u64;
    const FEE_DENOMINATOR: u64 = 10000u64;
    const TIMEOUT_BLOCKS: u64 = 604800u64;

    // ── State ──────────────────────────────────────────────────────
    state {
        status: u64,               // 0=waiting, 1=active, 2=complete, 3=forfeit, 4=timeout
        winner: Address,
        createdBlock: u64
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Resolve match
    // ═══════════════════════════════════════════════════════════════
    entrypoint function resolve(winnerAddr: Address, resolverSig: Sig) {
        require(state.status == 1u64, "Match is not active");
        require(winnerAddr == player1 || winnerAddr == player2, "Winner must be a participant");

        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;
        let validSig = checkSig(resolverSig, winnerAddr) || checkSig(resolverSig, treasury);
        require(validSig, "Invalid resolver signature");

        // Get pool from this covenant UTXO
        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());

        // Final round: champion payout
        if (round == 2u64) {
            let fee = (pool * FEE_BPS) / FEE_DENOMINATOR;
            let payout = pool - fee;
            require(payout > 0u64, "Payout underflow");

            outputs.push({script: winnerAddr.toScript(), amount: payout});
            outputs.push({script: treasury.toScript(), amount: fee});

            require(OP_COVENANTCOUNT() == 2u64, "Final: 2 outputs");
            emit Event("CHAMPION", tournamentId, winnerAddr, payout, fee);
        }
        // Non-final: spending TX creates next covenant UTXO
        else {
            require(OP_COVENANTCOUNT() == 1u64, "Advance: 1 covenant output");
            emit Event("ROUND_ADVANCED", tournamentId, round, winnerAddr);
        }

        state.winner = winnerAddr;
        state.status = 2u64;
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Forfeit
    // ═══════════════════════════════════════════════════════════════
    entrypoint function forfeit(forfeiterAddr: Address, forfeiterSig: Sig) {
        require(state.status == 1u64, "Match is not active");
        require(forfeiterAddr == player1 || forfeiterAddr == player2, "Forfeiter must be a participant");
        require(checkSig(forfeiterSig, forfeiterAddr), "Invalid forfeiter signature");

        let winner: Address = (forfeiterAddr == player1) ? player2 : player1;
        let pool = OP_UTXOAMOUNT(OP_OUTPOINT_SELF());
        let treasury: Address = (network == 0u64) ? MAINNET_TREASURY : TESTNET_TREASURY;

        if (round == 2u64) {
            let fee = (pool * FEE_BPS) / FEE_DENOMINATOR;
            let payout = pool - fee;
            require(payout > 0u64, "Payout underflow");
            outputs.push({script: winner.toScript(), amount: payout});
            outputs.push({script: treasury.toScript(), amount: fee});
            require(OP_COVENANTCOUNT() == 2u64, "Final: 2 outputs");
        } else {
            require(OP_COVENANTCOUNT() == 1u64, "Advance: 1 output");
        }

        state.winner = winner;
        state.status = 3u64;
        emit Event("MATCH_FORFEIT", tournamentId, round, forfeiterAddr, winner);
    }

    // ═══════════════════════════════════════════════════════════════
    // Entrypoint: Timeout
    // ═══════════════════════════════════════════════════════════════
    entrypoint function timeout(claimantAddr: Address, claimantSig: Sig, currentBlock: u64) {
        require(state.status == 1u64, "Match is not active");
        require(claimantAddr == player1 || claimantAddr == player2, "Claimant must be a participant");
        require(checkSig(claimantSig, claimantAddr), "Invalid claimant signature");

        require(currentBlock >= state.createdBlock + TIMEOUT_BLOCKS, "Timeout not reached");

        // Both players get their entry fees back
        outputs.push({script: player1.toScript(), amount: entryFee});
        outputs.push({script: player2.toScript(), amount: entryFee});

        state.status = 4u64;
        emit Event("MATCH_TIMEOUT", tournamentId, round, claimantAddr);
    }
}
