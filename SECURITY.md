# Security Policy

## Reporting a Vulnerability

**Do NOT open a public issue.** Instead, report vulnerabilities to:

- Email: security@high-table.protocol (preferred)
- Or open a private security advisory on GitHub

You will receive a response within 48 hours.

## Scope

Security issues include but are not limited to:

- Private key leakage or insecure key handling
- Transaction malleability or signature bypass
- Covenant logic errors that enable theft
- WebSocket injection or XSS in frontend
- UTXO double-spend attacks
- Oracle collusion vectors

## Bug Bounty

We offer bounties for critical vulnerabilities. Amounts are determined case-by-case based on severity:

| Severity | Range |
|----------|-------|
| Critical | Direct fund loss — negotiable |
| High | Logic bypass, oracle compromise |
| Medium | DoS, information disclosure |
| Low | UI bugs, minor issues |

## Supported Versions

| Version | Supported |
|---------|-----------|
| v1.0.x  | ✅ Active |
| v0.9.x  | ❌ EOL |
| v0.x    | ❌ EOL |

## Disclosure Policy

- 90-day responsible disclosure window standard
- Public acknowledgement in release notes after fix
- CVE assigned for critical issues