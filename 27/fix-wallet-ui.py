with open('index.html', 'r') as f:
    src = f.read()

# Fix 1: Make network detection handle tn12/testnet-10/testnet-12 variants
old = "var isMainnet = network === 'mainnet' || network === 0;"
new = "var isMainnet = network === 'mainnet' || network === 0 || network === 'MAINNET';\n    var isTN12 = typeof network === 'string' && (network.includes('test') || network.includes('tn') || network === '10');"

# Fix 2: Replace the htpSetNetwork call to use isTN12
old2 = "if (isMainnet) { if (typeof htpSetNetwork === 'function') htpSetNetwork('mainnet'); }\n      else if (String(network).includes('test')) { if (typeof htpSetNetwork === 'function') htpSetNetwork('tn12'); }"
new2 = "if (isTN12) { if (typeof htpSetNetwork === 'function') htpSetNetwork('tn12'); }\n      else if (isMainnet) { /* stay on current network — don't override TN12 default */ }"

count1 = src.count(old)
count2 = src.count(old2)
print(f'Pattern 1 found: {count1} times')
print(f'Pattern 2 found: {count2} times')
