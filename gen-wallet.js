const bip39 = require('bip39');
const hdkey = require('ed25519-hd-key');
const blake = require('blakejs');
const fs = require('fs');

const mnemonic = bip39.generateMnemonic();
console.log("MNEMONIC:", mnemonic);

const seed = bip39.mnemonicToSeedSync(mnemonic);
const path = "m/44'/111111'/0'/0/0";
const derived = hdkey.derivePath(path, seed.toString('hex'));

const privkey = derived.key.subarray(0, 32);
const pubkey = derived.key.subarray(32);

console.log("PRIVKEY:", privkey.toString('hex'));
console.log("PUBKEY:", pubkey.toString('hex'));

// Kaspa P2PK address payload: version byte 0x00 + blake2b(pubkey)
const hash = blake.blake2b(pubkey, null, 32);
const addrPayload = Buffer.concat([Buffer.from([0x00]), Buffer.from(hash)]);

const wallet = {
    mnemonic: mnemonic,
    privkey: privkey.toString('hex'),
    pubkey: pubkey.toString('hex'),
    addressPayload: addrPayload.toString('hex'),
};

fs.writeFileSync('/root/htp/.server-wallet.json', JSON.stringify(wallet, null, 2));
console.log("\nSAVED to /root/htp/.server-wallet.json");
console.log("ADDR_PAYLOAD_HEX:", addrPayload.toString('hex'));
