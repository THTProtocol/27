with open('htp-rpc-client.js', 'r') as f:
    src = f.read()

old = "const NETWORK_ID = (window.HTP_NETWORK || 'mainnet');"
new = "const NETWORK_ID = (window.HTP_NETWORK || 'testnet-12');"

if old in src:
    src = src.replace(old, new)
    with open('htp-rpc-client.js', 'w') as f:
        f.write(src)
    print('FIXED')
else:
    print('NOT FOUND')
