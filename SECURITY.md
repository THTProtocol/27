# Security Policy — High Table Protocol

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via:
- **GitHub Security Advisories** — [open a private advisory](https://github.com/THTProtocol/27/security/advisories/new) (preferred)
- **Email** — hightable.market@gmail.com

You will receive an acknowledgement within 48 hours.

## Scope

The following are in scope:

- Private key leakage or insecure key handling in frontend or backend
- Escrow covenant logic errors that could enable unauthorised fund access
- Oracle attestation bypass or quorum manipulation
- Transaction malleability or Schnorr signature bypass
- WebSocket injection, XSS, or CSRF in the frontend
- UTXO double-spend attack vectors
- Bond slashing evasion
- SQLite injection via API inputs

## Bug Bounty

We recognise responsible disclosure with bounties determined case-by-case:

| Severity | Criteria | Range |
|---|---|---|
| **Critical** | Direct or indirect loss of participant funds | Negotiable |
| **High** | Oracle compromise, covenant bypass, arbiter key exposure | KAS reward |
| **Medium** | DoS, information disclosure, auth bypass | KAS reward |
| **Low** | UI bugs, minor logic errors | Public credit |

## Supported Versions

| Version | Supported |
|---|---|
| `v1.0.x` | ✅ Active |
| `v0.9.x` | ❌ End of life |
| `v0.x` | ❌ End of life |

## Disclosure Policy

- **90-day** responsible disclosure window from acknowledgement
- Public acknowledgement in release notes after patch ships
- CVE assigned for critical severity issues
- We will not take legal action against good-faith security researchers

## Known Design Limitations (Pre-Toccata)

Until the Toccata hard fork activates covenant opcodes on Kaspa mainnet:

- Settlement relies on a **server-side arbiter key** — this is a trusted component
- The arbiter key is isolated in the backend and never exposed to the frontend
- Post-Toccata, settlement will be fully non-custodial via on-chain covenant spend paths
