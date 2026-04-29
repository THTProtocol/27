// Real wallet logos — inline SVG where PNG unavailable, img for rest
const S = 'width:40px;height:40px;border-radius:10px;object-fit:contain;';

window.HTP_WALLET_LOGOS = {
  // Inline SVG — exact KasWare FX |< brand mark
  KasWare: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" style="border-radius:10px">
    <rect width="40" height="40" rx="10" fill="#49EACB"/>
    <rect x="3" y="3" width="34" height="34" rx="7" fill="#0a1f1a"/>
    <text x="20" y="27" font-family="monospace" font-size="17" font-weight="900" fill="#49EACB" text-anchor="middle">|&lt;</text>
  </svg>`,

  Kastle:   `<img src="img/kastle.png"   onerror="this.src='https://kastle.cc/favicon.ico'"    style="${S}">`,
  Kasperia: `<img src="img/kasperia.png" onerror="this.src='https://kasperia.com/favicon.ico'"  style="${S}">`,
  Kasanova: `<img src="https://kasanova.app/favicon.ico" onerror="this.src='https://kasanova.io/favicon.ico'" style="${S}">`,
  Kaspium:  `<img src="https://kaspium.io/favicon.ico"  style="${S}">`,
  KaspaCom: `<img src="https://kaspacom.com/favicon.ico" onerror="this.src='https://kaspa.com/favicon.ico'" style="${S}">`,
  DEXcc:    `<img src="https://dex.cc/favicon.ico" style="${S}">`,
  OKX:      `<img src="https://www.okx.com/favicon.ico" style="${S}">`,
  KaspaNG:  `<img src="https://kaspa-ng.org/favicon.ico" onerror="this.src='https://kaspa-ng.app/favicon.ico'" style="${S}">`,
  Tangem:   `<img src="https://tangem.com/favicon.ico" style="${S}">`,
  KSPRBot:  `<img src="https://kspr.app/favicon.ico" onerror="this.src='https://t.me/favicon.ico'" style="${S}">`,
};

window.getWalletLogo = function(walletName) {
  return window.HTP_WALLET_LOGOS[walletName]
    || `<img src="https://www.google.com/s2/favicons?domain=kaspa.org&sz=64" style="${S}">`;
};
