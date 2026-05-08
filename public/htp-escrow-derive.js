(function() {
  async function deriveEscrowKey(matchId, creatorAddr) {
    if (!matchId || !creatorAddr) throw new Error("deriveEscrowKey: missing args");
    var stored = localStorage.getItem("htp_wallet_seed_enc");
    if (!stored) throw new Error("deriveEscrowKey: no wallet seed in storage");
    var seedBytes = new TextEncoder().encode(stored);
    var key = await crypto.subtle.importKey("raw", seedBytes, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
    var msgBytes = new TextEncoder().encode(matchId + "|" + creatorAddr);
    var sig = await crypto.subtle.sign("HMAC", key, msgBytes);
    var hex = Array.from(new Uint8Array(sig)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");
    return hex;
  }
  window.deriveEscrowKey = deriveEscrowKey;
})();
