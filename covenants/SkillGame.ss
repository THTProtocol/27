// SkillGame.ss — HTP Skill Match Covenant
// Kaspa Silverscript (Toccata-compatible)
// Version: 2.0.0

contract SkillGame(
  player1:  Address,
  player2:  Address,
  oracle:   Address,
  stake:    u64,        // per-player stake in sompi
  matchId:  Bytes32,    // unique match identifier
  created:  u64         // blockDAG score at creation
) {

  // ─── Settle: oracle attests result, winner takes pot minus fee ───
  entrypoint function settle(
    winner:    Address,
    oracleSig: Signature
  ) {
    require(winner == player1 || winner == player2,
      "winner must be player1 or player2");
    require(checkSig(oracleSig, oracle),
      "invalid oracle signature");
    let pot      = stake * 2;
    let fee      = pot / 50;              // 2% protocol fee
    let treasury = Address("kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m");
    pay winner (pot - fee);
    pay treasury fee;
  }

  // ─── Draw: oracle attests draw, both players refunded minus fee ──
  entrypoint function settleDraw(oracleSig: Signature) {
    require(checkSig(oracleSig, oracle), "invalid oracle signature");
    let fee      = stake / 50;
    let treasury = Address("kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m");
    pay player1 (stake - fee);
    pay player2 (stake - fee);
    pay treasury (fee * 2);
  }

  // ─── Timeout: either player can refund after 48h (~172800 blocks) ─
  entrypoint function refund(claimant: Address) {
    require(claimant == player1 || claimant == player2,
      "claimant must be a player");
    require(blockDaaScore() >= created + 172800,
      "timeout window not elapsed");
    pay player1 stake;
    pay player2 stake;
  }
}
