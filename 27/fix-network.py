with open('htp-init-rpc-patch.js', 'r') as f:
    src = f.read()

old = "if (!window.HTP_NETWORK) window.HTP_NETWORK = 'mainnet';"
new = "if (!window.HTP_NETWORK) window.HTP_NETWORK = 'testnet-12';"

if old in src:
    src = src.replace(old, new)
    with open('htp-init-rpc-patch.js', 'w') as f:
        f.write(src)
    print('FIXED')
else:
    print('NOT FOUND — dumping line 32:')
    lines = src.splitlines()
    print(repr(lines[31]))
