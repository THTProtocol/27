// HTP Protocol — Central Configuration v1.0
// Change network/treasury here to switch testnet <-> mainnet
window.HTP_CONFIG = {
  network:            'tn12',
  wsEndpoint:         'wss://tn12.kaspa.stream/wrpc/borsh',
  wsFallback:         'wss://178.105.76.81/ws',
  treasury:           'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m',
  feePct:             0.02,
  maximizerInsurance: 0.3,
  maximizerRebate:    0.5,
  firebaseProject:    'hightable420',
  kgiBase:            'https://kgi.kaspad.net:3147',
};
window.activeNet    = window.HTP_CONFIG.network;
window.HTP_TREASURY = window.HTP_CONFIG.treasury;
window.HTP_FEE_PCT  = window.HTP_CONFIG.feePct;
console.log('[HTP Config] loaded —', window.HTP_CONFIG.network);
