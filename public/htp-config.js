// HTP CONFIG — centralised for easy mainnet switch
window.HTP_CONFIG = {
  API_ORIGIN: "https://hightable.duckdns.org",
  WS_URL:     "wss://hightable.duckdns.org/ws",
  NETWORK:    "tn12",
  FEE_PCT:    0.02,
  TREASURY:   "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m",
  MAINNET_READY: false
};
window.activeNet = window.HTP_CONFIG.NETWORK;
window.net       = window.HTP_CONFIG.NETWORK;
