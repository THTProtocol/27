// Real wallet logos — PNG assets for local, favicon URLs for external
window.HTP_WALLET_LOGOS = {
  KasWare:  `<img src="img/kasware.png"  onerror="this.src='https://kasware.xyz/favicon.ico'"  style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  Kastle:   `<img src="img/kastle.png"   onerror="this.src='https://kastle.cc/favicon.ico'"    style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  Kasperia: `<img src="img/kasperia.png" onerror="this.src='https://kasperia.com/favicon.ico'"  style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  Kasanova: `<img src="https://kasanova.app/favicon.ico" onerror="this.src='https://kasanova.io/favicon.ico'" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  Kaspium:  `<img src="https://kaspium.io/favicon.ico"  style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  KaspaCom: `<img src="https://kaspacom.com/favicon.ico" onerror="this.src='https://kaspa.com/favicon.ico'" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  DEXcc:    `<img src="https://dex.cc/favicon.ico" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  OKX:      `<img src="https://www.okx.com/favicon.ico" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  KaspaNG:  `<img src="https://kaspa-ng.org/favicon.ico" onerror="this.src='https://kaspa-ng.app/favicon.ico'" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  Tangem:   `<img src="https://tangem.com/favicon.ico" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
  KSPRBot:  `<img src="https://kspr.app/favicon.ico" onerror="this.src='https://t.me/favicon.ico'" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`,
};

window.getWalletLogo = function(walletName) {
  return window.HTP_WALLET_LOGOS[walletName] || `<img src="https://www.google.com/s2/favicons?domain=kaspa.org&sz=64" style="width:40px;height:40px;border-radius:10px;object-fit:contain;">`;
};
