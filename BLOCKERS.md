# BLOCKERS — High Table Protocol production push

## Block 1: GitHub PAT lacks write scope

The fine-grained PAT supplied in the prompt authenticates as `THTProtocol`
and has read access (HTTP 200 on `GET /repos/THTProtocol/27`, fetch succeeds),
but `git push` returns:

    remote: Permission to THTProtocol/27.git denied to THTProtocol.
    fatal: unable to access ... 403

Workaround applied:
- All Tier 1 and Tier 2 fixes are committed locally on both the dev workspace
  and the Hetzner server (`/root/htp`).
- A new branch `agent/tier12-fixes` is created on the server side as well,
  so the changes survive any future fetch/reset.
- Firebase deploy (`hosting` + `database`) is independent of GitHub — the
  user-visible site is updated through that path.

Action needed from the user:
- Issue a PAT with `Contents: Read & Write` on the `THTProtocol/27` repo,
  or push from a workstation that already holds an authorized SSH key.

## Block 2: Mainnet treasury address is a placeholder

`htp-covenant-escrow-v2.js` now uses two treasury addresses:
- Testnet: `kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m`
- Mainnet: `kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel`

The mainnet value was carried over from prior code in this codebase.
Confirm it matches the production treasury before flipping the network toggle
in production traffic.
