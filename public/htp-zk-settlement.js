  window.htpSettleWithProof = async function (matchId, winnerAddr, reason, gameType) {
    var proof = await window.htpBuildGameProof(matchId, gameType, winnerAddr, reason);

    // Store proof in Firebase
    try {
      firebase.database().ref('gamechain/' + matchId + '/proof').set(proof);
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
        firebase.database().ref('gamechain/' + matchId + '/settleTx').set({
          txId:       txId,
          winner:     winnerAddr,
          proofHash:  proof.proofHash,
          ts:         Date.now()
        });
      } catch (e) {}
      console.log('[HTP Server] Settled match', matchId, 'txId:', txId.substring(0, 16) + '...');
    }
    return txId;
  };

