# Security Policy — SyncBoard

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities. Email the maintainers through the
GitHub Security Advisory "Report a vulnerability" button with:

- affected version and component (web, API, gateway, uploads),
- step-by-step reproduction or proof of concept,
- impact assessment (confidentiality, integrity, availability),
- suggested mitigation if known.

You will receive an acknowledgement within 72 hours and a remediation plan within 7 days. Please allow
30 days before coordinated public disclosure. We do not pursue legal action against good-faith research.

## Threat boundaries

- **Trusted:** authenticated owner/editor actions within their own boards, platform configuration.
- **Untrusted:** user-supplied text, display names, uploaded files, WebSocket frames, invite links,
  query parameters and cookies.
- **Out of scope:** compromise of the host machine, TLS termination upstream of Nginx, and
  vulnerabilities in managed PostgreSQL/Redis providers.

## Implemented controls (overview)

Argon2id password hashing, rotating refresh tokens with reuse detection, short-lived access JWTs,
single-use WS tickets, server-side CRDT RBAC filtering, live revocation via Redis pub/sub, strict CSP
and CORS, CSRF origin checks, request/frame size caps, magic-byte upload validation with Sharp
re-encoding and DOMPurify SVG sanitization, structured log redaction, and automated dependency audits.
