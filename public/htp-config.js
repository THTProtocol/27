// HTP Protocol - Central Configuration v1.0
// Set network: 'tn12' for testnet, 'mainnet' for production
window.HTP_CONFIG = {
  network:            'tn12',
  wsEndpoint:         'wss://api-tn12.kaspa.org/ws',
  wsFallback:         'wss://178.105.76.81/ws',
  // MAINNET SWITCH: uncomment these two lines and set network: 'mainnet'
  // wsEndpoint:      'wss://kaspa.stream/wrpc/borsh',
  // wsFallback:      'wss://178.105.76.81/ws',
  treasury:           'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m',
  // MAINNET TREASURY: 'kaspa:YOUR_MAINNET_TREASURY_ADDRESS'
  feePct:             0.02,
  maximizerInsurance: 0.3,
  maximizerRebate:    0.5,
  firebaseProject:    'hightable420',
};
window.activeNet    = window.HTP_CONFIG.network;
window.HTP_TREASURY = window.HTP_CONFIG.treasury;
window.HTP_FEE_PCT  = window.HTP_CONFIG.feePct;
