# SyncBoard — Software Requirements Specification (SRS)

**Version:** 1.0.0 · **Status:** Approved for implementation · **Date:** 2026-11-21

## 1. Purpose

SyncBoard is a real-time collaborative whiteboard for architecture diagrams, flowcharts, mind maps and
workshops. It must remain responsive with thousands of objects, converge concurrent edits without data
loss, and enforce permissions on both HTTP and WebSocket transports.

## 2. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-1 | Users can register, log in, log out and refresh sessions silently. |
| FR-2 | Dashboard lists boards with search, folders, favorites, archive and cursor pagination. |
| FR-3 | Users can create a blank board or one of three templates (Architecture Diagram, Flowchart, Mind Map). |
| FR-4 | Infinite canvas with cursor-centred zoom (0.1–5.0) and pan (space/middle-mouse/hand tool). |
| FR-5 | Adaptive architectural dot grid that never becomes visual noise. |
| FR-6 | Shape tools: rectangle, ellipse, line, arrow, freehand pen, text, sticky note, image. |
| FR-7 | Eraser, selection, marquee multi-select, grouping, transformer, layer order and clipboard. |
| FR-8 | User-scoped undo/redo: undo never reverts another collaborator's work. |
| FR-9 | Real-time shared document based on a Yjs CRDT with binary sync protocol. |
| FR-10 | Live presence: remote cursors, names/colors, selections and collaborator count. |
| FR-11 | Roles: OWNER, EDITOR, COMMENTER, VIEWER; enforced server-side on REST and WS. |
| FR-12 | Invite by email/username, shareable links with configurable default role, role change and revocation. |
| FR-13 | Smart connectors bind arrows to shapes and follow moves/resize/rotation; optional elbow routing. |
| FR-14 | Presentation follow-me mode broadcasting the presenter viewport. |
| FR-15 | Pinned contextual comments with threaded replies and resolve toggle. |
| FR-16 | Version history snapshots with read-only preview and non-destructive restore. |
| FR-17 | Exports: high-DPI PNG, pure vector SVG, PDF. |
| FR-18 | Image upload with validated magic bytes, sanitized raster/SVG and board-scoped URLs. |
| FR-19 | Audit log of security-relevant events and structured redacted logging. |
| FR-20 | Health endpoints (liveness and readiness) and graceful shutdown. |

## 3. Non-Functional Requirements

| ID | Target |
| --- | --- |
| NFR-1 | Cursor/presence propagation p95 < 60 ms on a LAN or regional connection. |
| NFR-2 | Canvas frame time <= 16.6 ms (60 FPS) with 5,000 visible objects on reference hardware. |
| NFR-3 | >= 20 (tested at 25) concurrent editors per board with 100% CRDT convergence. |
| NFR-4 | Board renders use rbush viewport culling; only visible elements mount into Konva. |
| NFR-5 | CRDT snapshots flushed debounced (3 s activity, 15 s ceiling, immediate on last leave). |
| NFR-6 | Offline edits persist in IndexedDB and merge automatically on reconnect. |
| NFR-7 | Access JWT lifetime 15 minutes; refresh tokens rotate on each use. |
| NFR-8 | Frontend production bundle gzip < 500 KB initial route. |
| NFR-9 | API p95 < 150 ms for board CRUD under normal load. |
| NFR-10 | All runtime images run as non-root. |

## 4. Security Requirements

| ID | Requirement |
| --- | --- |
| SR-1 | Zero plaintext secrets in source, logs, Git history or URLs. |
| SR-2 | Argon2id (64 MiB, t=3, p=1) password hashing. |
| SR-3 | Refresh tokens stored only as SHA-256 hashes; HttpOnly, Secure, SameSite=Lax cookies. |
| SR-4 | Refresh token reuse detection revokes the whole token family and writes an audit event. |
| SR-5 | Server-side RBAC on every REST mutation and every incoming Yjs write frame. |
| SR-6 | Single-use WS tickets, never long-lived JWTs in query strings. |
| SR-7 | Strict Helmet/CSP, explicit CORS allowlist, Origin/CSRF guard, DTO whitelisting. |
| SR-8 | Redis sliding-window rate limits for auth, mutations and WebSocket frames; 1 MiB frame cap. |
| SR-9 | Uploads validated by magic bytes, re-encoded via Sharp, SVG sanitized, served sandboxed. |
| SR-10 | Secrets redacted in logs; Dependabot + `pnpm audit --audit-level=high` gate in CI. |

## 5. Acceptance

The implementation is accepted when `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` pass,
Docker images build, the multi-user Playwright suite converges, and the load harness reports 100%
state-hash equality across 25 simulated clients.
