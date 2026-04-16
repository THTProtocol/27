// HTP ZK Proof Pipeline — Toccata HF Ready
// Proof system: SHA-256 commit NOW, upgrades to on-chain ZK verify after Toccata HF
//
// Toccata zk_precompiles (kaspanet/rusty-kaspa branch: covpp-reset2):
//   ZkTag::Groth16    = 0x20  cost: 140,000 script-units (~3 verifies/block)
//   ZkTag::R0Succinct = 0x21  cost: 250,000 script-units (~2 verifies/block)
//
// When Toccata activates, upgrade path:
//   proofSystem: 'groth16'   → push [proof_bytes, 0x20] then OP_ZK_VERIFY
//   proofSystem: 'r0succinct'→ push [proof_bytes, 0x21] then OP_ZK_VERIFY
//
// Until then: SHA-256 commit to Firebase + SequencingCommitment (KIP-15) for ordering.
(function () {
  'use strict';

  // Toccata ZkTag constants (from rusty-kaspa covpp-reset2)
  var ZK_TAG = {
    GROTH16:     0x20,
    R0_SUCCINCT: 0x21
  };

  // ── 1. REPLACE FAKE ZK CONFIRMATION IN submitAttestation ───────
  setTimeout(function () {
    var _origAttest = window.submitAttestation;
    if (typeof _origAttest !== 'function') return;

    window.submitAttestation = async function () {
      var marketId = document.getElementById('attestPanel') &&
                     document.getElementById('attestPanel').dataset.marketId;
      var outcome  = document.getElementById('attestOutcome') &&
                     document.getElementById('attestOutcome').value;
      var evidence = document.getElementById('attestEvidence') &&
                     document.getElementById('attestEvidence').value;
      var addr     = window.walletAddress || window.htpAddress;

      if (!marketId || !outcome || !evidence || !addr) {
        if (typeof _origAttest === 'function') return _origAttest.apply(this, arguments);
        return;
      }

      var ts = Date.now();
      var raw = evidence + ':' + outcome + ':' + marketId + ':' + addr + ':' + ts;
      var enc = new TextEncoder().encode(raw);
      var buf = await crypto.subtle.digest('SHA-256', enc);
      var proofHash = Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

      var hashEl = document.getElementById('attestHash');
      if (hashEl) hashEl.value = proofHash;

      try { await _origAttest.apply(this, arguments); } catch(e) {}

      if (window.firebase) {
        var proofEntry = {
          oracle:      addr,
          marketId:    marketId,
          outcome:     outcome,
          evidenceUrl: evidence,
          proofHash:   proofHash,
          // Toccata upgrade path:
          //   pre-Toccata:  proofSystem='sha256-commit', zkTag=null
          //   post-Toccata: proofSystem='groth16', zkTag=0x20
          //                 proofSystem='r0succinct', zkTag=0x21
          proofSystem: 'sha256-commit',
          zkTag:       null,  // set to ZK_TAG.GROTH16 (0x20) after Toccata HF
          toccataReady: true, // flag: pipeline is structured for Toccata upgrade
          submittedAt: ts,
          status:      'submitted',
          verifiedAt:  null,
          verificationTx: null
        };

        try {
          await firebase.database().ref('oracleProofs/' + marketId).set(proofEntry);
          await firebase.database().ref('attestations/' + marketId).update({
            proofHash:   proofHash,
            proofStatus: 'submitted',
            proofAt:     ts
          });
          console.log('%cHTP ZK: proof committed (SHA-256 commit, Toccata-ready) ' + proofHash.substring(0, 16), 'color:#49e8c2');

          if (typeof updateResLifecycle === 'function') updateResLifecycle(3);
          var statusEl = document.getElementById('attestStatus');
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML += '<br><span style="color:var(--accent)">' +
              'Proof committed. Hash: ' + proofHash.substring(0, 16) + '...' +
              ' Dispute window: 24h. (Toccata on-chain verify: pending HF)</span>';
          }
          if (typeof renderZkStatus === 'function') renderZkStatus();

          if (window.htpZkOracle) {
            window.htpZkOracle.register(marketId, proofHash, {
              proofSystem:  'sha256-commit',
              zkTag:        null,           // upgrade to 0x20 (Groth16) post-Toccata
              verifierUrl:  null,           // set when Toccata OP_ZK_VERIFY is live
              toccataReady: true
            });
          }

          setTimeout(function () {
            if (typeof updateResLifecycle === 'function') updateResLifecycle(4);
          }, 2000);

        } catch (e) {
          console.warn('HTP ZK: Firebase proof commit failed', e.message);
        }
      }
    };

    console.log('%cHTP ZK: submitAttestation patched — Toccata-ready (ZkTag 0x20/0x21)', 'color:#49e8c2;font-weight:bold');
  }, 2000);

  // ── 2. PATCH pollCycle TO AUTO-ATTEST ──────────────────────────
  setTimeout(function () {
    var _origPollCycle = window.pollCycle;
    if (typeof _origPollCycle !== 'function') {
      console.warn('HTP ZK: pollCycle not on window — daemon auto-attest will use event listener');
      return;
    }

    window.pollCycle = async function () {
      await _origPollCycle.apply(this, arguments);

      var OD = window.OD;
      if (!OD || !OD.run || !OD.apiUrl || !OD.oracleAddr) return;

      try {
        var snap = await firebase.database()
          .ref('markets')
          .orderByChild('status').equalTo('closed')
          .once('value');

        snap.forEach(async function (child) {
          var m = child.val();
          var mid = child.key;
          if (!m || m.resolvedAt || m.autoAttested) return;

          try {
            var r = await Promise.race([
              fetch(OD.apiUrl),
              new Promise(function(_, rj) { setTimeout(function() { rj(new Error('timeout')); }, 5000); })
            ]);
            if (!r.ok) return;
            var data = await r.json();
            var val = OD.apiPath
              ? OD.apiPath.split('.').reduce(function (o, k) { return o && o[k]; }, data)
              : data;

            var outcomes = m.outcomes || [];
            var matched = null;
            for (var i = 0; i < outcomes.length; i++) {
              if (String(val).toLowerCase().includes(String(outcomes[i]).toLowerCase()) ||
                  String(outcomes[i]).toLowerCase().includes(String(val).toLowerCase())) {
                matched = outcomes[i];
                break;
              }
            }
            if (!matched) return;

            console.log('%cHTP Daemon: auto-attesting ' + mid + ' → ' + matched, 'color:#49e8c2');

            var ts2 = Date.now();
            var rawStr = OD.apiUrl + ':' + matched + ':' + mid + ':' + OD.oracleAddr + ':' + ts2;
            var enc2 = new TextEncoder().encode(rawStr);
            var buf2 = await crypto.subtle.digest('SHA-256', enc2);
            var ph = Array.from(new Uint8Array(buf2))
              .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

            await firebase.database().ref('oracleProofs/' + mid).set({
              oracle:       OD.oracleAddr,
              marketId:     mid,
              outcome:      matched,
              evidenceUrl:  OD.apiUrl,
              proofHash:    ph,
              proofSystem:  'sha256-commit',
              zkTag:        null,
              toccataReady: true,
              submittedAt:  ts2,
              status:       'submitted',
              auto:         true
            });

            await firebase.database().ref('attestations/' + mid).set({
              oracle:        OD.oracleAddr,
              outcome:       matched,
              evidenceHash:  ph,
              attestedAt:    ts2,
              disputeEndsAt: ts2 + 24 * 60 * 60 * 1000,
              status:        'pending',
              challenged:    false,
              network:       window.activeNet || 'tn12',
              proofHash:     ph
            });

            await firebase.database().ref('markets/' + mid + '/autoAttested').set(true);

            OD.resolved = (OD.resolved || 0) + 1;
            if (typeof uiSync === 'function') uiSync();
            if (typeof odlog === 'function') odlog('Auto-attested: ' + mid.substring(0, 12) + ' → ' + matched);
            if (typeof showToast === 'function') showToast('Auto-attested: ' + matched, 'success');

          } catch (e) {
            if (typeof odlog === 'function') odlog('Auto-attest failed: ' + e.message, true);
          }
        });
      } catch (e) {
        if (typeof odlog === 'function') odlog('Poll auto-attest: ' + e.message, true);
      }
    };

    console.log('%cHTP ZK: pollCycle patched — daemon auto-attest active', 'color:#49e8c2;font-weight:bold');
  }, 3000);

  // ── 3. WIRE htpSettleWithProof INTO handleMatchGameOver ────────
  setTimeout(function () {
    var _origGameOver = window.handleMatchGameOver;
    if (typeof _origGameOver !== 'function') return;

    window.handleMatchGameOver = async function (reason, winnerColor) {
      await _origGameOver.apply(this, arguments);

      var match = window.matchLobby && window.matchLobby.activeMatch;
      if (!match) return;
      var iAmCreator = match.creator === (window.matchLobby && window.matchLobby.myPlayerId);
      var seed = 0;
      var idStr = match.id.replace('HTP-', '');
      for (var i = 0; i < idStr.length; i++) seed += idStr.charCodeAt(i);
      var creatorFirst = seed % 2 === 0;
      var creatorColor = match.game === 'chess'
        ? (creatorFirst ? 'w' : 'b')
        : (creatorFirst ? 1 : 2);
      var iWon;
      if (reason === 'resign') {
        iWon = !iAmCreator;
      } else {
        iWon = (winnerColor === (iAmCreator ? creatorColor : (match.game === 'chess' ? (creatorFirst ? 'b' : 'w') : (creatorFirst ? 2 : 1))));
      }
      if (!iWon) return;

      var winnerAddr = window.walletAddress || window.htpAddress;
      if (!winnerAddr || !window.htpSettleWithProof) return;

      try {
        var txId = await window.htpSettleWithProof(match.id, winnerAddr, reason, match.game);
        if (txId) console.log('%cHTP ZK: proof-backed settlement ' + txId.substring(0, 16), 'color:#49e8c2;font-weight:bold');
      } catch (e) {
        console.warn('HTP ZK: htpSettleWithProof failed, original already ran', e.message);
      }
    };

    console.log('%cHTP ZK: handleMatchGameOver upgraded to proof-backed settlement', 'color:#49e8c2;font-weight:bold');
  }, 2500);

  // Expose ZkTag constants for other modules
  window.HTP_ZK_TAG = ZK_TAG;

  console.log('%cHTP ZK Pipeline v2 loaded — Toccata HF Ready', 'color:#49e8c2;font-weight:bold;font-size:13px');
  console.log('  ZkTag::Groth16    = 0x' + ZK_TAG.GROTH16.toString(16) + '  (140k script-units, ~3/block)');
  console.log('  ZkTag::R0Succinct = 0x' + ZK_TAG.R0_SUCCINCT.toString(16) + '  (250k script-units, ~2/block)');
  console.log('  Current proof:    SHA-256 commit → upgrades to Groth16 on Toccata activation');
  console.log('  Daemon:           auto-attest on API match');
  console.log('  Settlement:       proof-backed via htpSettleWithProof');
})();
