(function() {
  var net = window.__HTP_NETWORK__ || "tn12";
  var NETS = {
    tn12: {
      rest:    "https://api-tn12.kaspa.org",
      ws:      "wss://ws-tn12.kaspa.org",
      feeAddr: "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m",
      prefix:  "kaspatest"
    },
    mainnet: {
      rest:    "https://api.kaspa.org",
      ws:      "wss://ws.kaspa.org",
      feeAddr: "kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel",
      prefix:  "kaspa"
    }
  };
  var cfg = NETS[net] || NETS.tn12;
  window.HTP_CONFIG = {
    API_ORIGIN:    "https://hightable.pro",
    WS_URL:        "wss://hightable.pro/ws",
    NETWORK:       net,
    KASPA_REST:    cfg.rest,
    KASPA_WS:      cfg.ws,
    FEE_ADDR:      cfg.feeAddr,
    ADDR_PREFIX:   cfg.prefix,
    FEE_PCT:       0.02,
    FEE_BPS:       200,
    MAINNET_READY: true
  };
  window.activeNet   = net;
  window.net         = net;
  window.FEEADDR     = cfg.feeAddr;
  window.HTP_FEE_ADDR = cfg.feeAddr;
  window.addEventListener("load", function() {
    window.dispatchEvent(new CustomEvent("htp-network-changed", { detail: { net: net } }));
  });
})();
