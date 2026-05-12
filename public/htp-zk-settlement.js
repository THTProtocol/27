window.htpSettleWithProof = async function (matchId, winnerAddr, reason, gameType) {
    var proof = await window.htpBuildGameProof(matchId, gameType, winnerAddr, reason);

    // Store proof via REST API
    try {
      await fetch('/api/gamechain/' + matchId + '/proof', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(proof)
      });
    } catch (e) {}

    // Attempt Kaspa settlement with covenant
    var txId = null;
    try {
      if (typeof settleSkillMatch === 'function') {
        var match = matchLobby && matchLobby.activeMatch;
        if (match && match.covenantEnabled) {
          txId = await settleSkillMatch(matchId, winnerAddr);
        }
      }
      if (!txId && typeof sendFromEscrow === 'function') {
        txId = await sendFromEscrow(matchId, winnerAddr);
      }
    } catch (e) {
      console.error('[HTP Server] Settlement error:', e.message);
    }

    if (txId) {
      try {
        await fetch('/api/gamechain/' + matchId + '/settleTx', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            txId:       txId,
            winner:     winnerAddr,
            proofHash:  proof.proofHash,
            ts:         Date.now()
          })
        });
      } catch (e) {}
      console.log('[HTP Server] Settled match', matchId, 'txId:', txId.substring(0, 16) + '...');
    }
    return txId;
  };
