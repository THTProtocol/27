module.exports = {
  "apps": [
    {
      "name": "htp-server",
      "script": "/root/htp-server-bin",
      "cwd": "/root/htp",
      "env": {
        "PORT": "3000",
        "HTP_NETWORK": "tn12",
        "KASPA_WRPC_URL": "ws://localhost:17211",
        "MAINNET_API": "https://api.kaspa.org",
        "ALLOWED_ORIGINS": "https://hightable420.web.app,https://hightable420.firebaseapp.com",
        "ORACLE_KEY_1": "2a04833c84565179077491a52ff94915b27fb17b0e4af9a36d4516973d74cc75",
        "ORACLE_KEY_2": "432e5940d36a45f97a201872ae23cef2f26bc56edd16f7eb2acd642a440410cc",
        "ORACLE_KEY_3": "9a1accaf41f57b5b760f91f8228c0bf2db68b8a47b41f05ba83521223a973ab5",
        "PROTOCOL_ADDRESS": "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m",
        "PROTOCOL_FEE_BPS": "200",
        "AUTO_RESOLVE": "true",
        "ORACLE_CHECK_MS": "30000",
        "INDEXER_POLL_MS": "5000",
        "KASPA_REST_URL": "https://api-tn12.kaspa.org",
        "ARBITER_PRIVKEY": "e140201be584923cb08fba8111cb26a658864153ae6b16e11e187c1e3316a2a4",
        "GUARDIAN_PRIVKEY": "2719561192c62e801f45d0108dee24d5d6985f532069bd9a06006e862752a682",
        "HTP_ADMIN_KEY": "11b194eb5f38a2017823286ba089f799bb8e1289e2cb1f680e691316c7548361",
        "HTP_GUARDIAN_ADDRESS": "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m"
      },
      "restart_delay": 2000,
      "max_restarts": 10
    }
  ]
}