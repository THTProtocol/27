with open('index.html', 'r') as f:
    src = f.read()

old = "                var isMainnet = (network === 'mainnet' || network === 0);\n                if (isMainnet && typeof htpSetNetwork === 'function') {\n                    htpSetNetwork('mainnet');\n                } else if (String(network).includes('test') && typeof htpSetNetwork === 'function') {\n                    htpSetNetwork('tn12');\n                }"

new = "                var isMainnet = (network === 'mainnet' || network === 0);\n                var isTN12 = (typeof network === 'string' && (network.includes('test') || network.includes('tn12') || network.includes('TN12'))) || network === 10;\n                if (isTN12 && typeof htpSetNetwork === 'function') {\n                    htpSetNetwork('tn12');\n                } else if (isMainnet && typeof htpSetNetwork === 'function') {\n                    /* do not override TN12 default when extension reports mainnet */\n                    /* htpSetNetwork('mainnet'); */\n                }"

if old in src:
    src = src.replace(old, new)
    with open('index.html', 'w') as f:
        f.write(src)
    print('FIXED')
else:
    print('NOT FOUND - dumping lines 21330-21338:')
    lines = src.splitlines()
    for i, l in enumerate(lines[21328:21338], start=21329):
        print(repr(f'{i}: {l}'))
