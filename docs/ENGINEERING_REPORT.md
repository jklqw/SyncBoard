# SyncBoard — Technical Architecture, Optimization & Security Report

- **Project:** SyncBoard (Real-Time Collaborative Whiteboard)
- **Version:** 1.0.0
- **Author:** SyncBoard contributors
- **Last Updated:** 2026-11-21

---

## 1. Executive Summary & System Scope (Phase 0)

- **Problem Statement:** Traditional whiteboards broadcast raw JSON mouse/shape events and write each
  change straight to a database. Concurrent edits overwrite one another, dragging floods PostgreSQL,
  and rendering stalls after a few hundred objects.
- **Solution:** A Yjs CRDT document is the single source of truth for durable board elements; Yjs
  Awareness carries ephemeral cursor/presence data; Redis pub/sub bridges stateless WebSocket instances;
  a four-layer Konva stage with an rbush spatial index renders only the visible viewport; PostgreSQL
  stores compacted binary CRDT snapshots rather than row-per-shape JSON.
- **Target SLAs:** < 60 ms p95 cursor sync, 60 FPS at 5,000 elements, 0 data loss under 25 concurrent
  editors.
- **ADR-001 (CRDT over JSON patches):** Yjs gives mathematical convergence under concurrent offline
  edits and user-scoped undo via UndoManager origins; JSON last-write-wins does not.
- **ADR-002 (Konva + rbush over DOM/SVG):** retained-mode canvas with four isolated layers avoids
  full-scene React reconciliations; rbush reduces viewport queries to O(log n).
- **ADR-003 (NestJS + PostgreSQL + Redis):** modular DI for guards/interceptors, stateless API and WS
  processes, relational RBAC metadata, BYTEA snapshots, pub/sub fanout and distributed rate limits.
- **UI direction:** warm architectural paper (`#FAF9F6`), white floating surfaces, hairline borders,
  restrained cobalt accent, JetBrains Mono numeric readouts, and 95% of the viewport devoted to canvas.

## 2. Domain Modeling & Persistence Architecture (Phase 1)

### Canonical element contracts

Every board element is validated with a Zod discriminated union on `type` before it can enter the
CRDT document. Shared fields are `id`, `x`, `y`, `width`, `height`, `rotation`, `zIndex`, optional
`groupId`, `style`, `locked` and `updatedAt`. Nine variants are supported: rectangle, ellipse, frame,
line, arrow, freehand, text, sticky note and image. Arrows carry optional `startBinding`/`endBinding`
(`{ elementId, anchor }`) used by smart connectors. The same schemas are imported by the NestJS DTO
validation layer and the React canvas, so an invalid shape is rejected identically on both sides.

### Fractional indexing

`zIndex` is a **string** fractional index, not an integer. Moving an element between two neighbours
produces a new string between them (e.g. `a` → `aV`, `aT`) instead of renumbering every sibling. Two
clients reordering concurrently in the CRDT therefore cannot clobber each other's ordering values.

### Relational schema

`User`, `RefreshToken`, `Board`, `BoardMember`, `BoardSnapshot`, `BoardComment` and `AuditLog` are
first-class relational models with unique constraints on `(boardId, userId)` memberships, unique
token hashes and share tokens, and composite indexes on the hot paths (`ownerId, updatedAt`,
`boardId, createdAt`, `userId, familyId`). Cascade deletes keep board-related data consistent;
audit logs use `SetNull` to preserve activity history after user deletion.

### Why BYTEA snapshots beat row-per-shape JSONB

A row-per-shape design issues an UPDATE for every drag frame and requires conflict resolution for
each field. SyncBoard instead keeps a single compacted `Y.encodeStateAsUpdate(doc)` binary in
`Board.yjsState`. Updates are accumulated in memory and flushed at most every 3 seconds (15-second
ceiling), reducing write amplification by orders of magnitude during drawing. `stateVersion` plus a
Redis lock guards eviction so two stateless instances cannot overwrite a newer snapshot. Version
history stores full binary `BoardSnapshot` rows, enabling exact point-in-time restore.

## 3. Canvas Rendering & Performance Engineering (Phase 2)

### Four-layer Konva stage

The canvas is split into isolated Konva layers so a local drag or cursor move never
invalidates the full scene graph:

| Layer | Contents | Repaint trigger |
| --- | --- | --- |
| Grid | Dot / line background | Viewport pan/zoom only |
| Static | Non-selected durable elements | CRDT change outside selection |
| Active | Selected / in-progress shapes | Pointer gestures, transformers |
| Overlay | Remote cursors, selection chrome, snap guides | Awareness + UI chrome |

### Spatial index

`rbush` stores axis-aligned bounds for every durable element. Viewport queries are
$O(\log n + k)$ instead of scanning the full array, so pan/zoom only mounts shapes that
intersect the camera frustum. Shape nodes are memoized by stable element `id` + revision
so React reconciles only dirty leaves.

### Presence budget

Remote cursors ride Yjs Awareness at ≤ 30 Hz and are interpolated with
`requestAnimationFrame` on the client so the overlay layer stays smooth without flooding
the WebSocket.

### Performance numbers (estimated / synthetic)

Live browser FPS capture was **not executed** in this environment: Docker Hub returns
403 for base images, so a full interactive board with the stress harness could not be
driven end-to-end. The table below records **synthetic estimates** derived from the
architecture budget (60 FPS target at 5k elements with culling) and the
`generateStressElements` helper. Replace with measured Chrome Performance-panel samples
once the stack is runnable.

| Element Count | Without Culling (FPS, estimated) | With RBush + Layer Isolation (FPS, estimated) | Heap Memory (MB, estimated) |
| --- | --- | --- | --- |
| 500 | ~45–55 | ~60 | ~35–50 |
| 2,000 | ~18–28 | ~55–60 | ~70–95 |
| 5,000 | ~6–12 | ~50–60 | ~140–180 |

**How to replace estimates:** open a board with `?stress=5000`, record 10 s of
`requestAnimationFrame` deltas with and without the spatial index path, and overwrite
this table with p50/p95 frame times converted to FPS.

## 4. Authentication & RBAC Enforcement (Phase 3)

### Password hashing

Passwords are hashed with **Argon2id** (`memoryCost: 65_536` KiB ≈ 64 MiB,
`timeCost: 3`, `parallelism: 1`). Verification is constant-time via `argon2.verify`.

### Token lifecycle

1. Login / register issues a short-lived **access JWT** (default TTL `15m`) returned to
   the SPA and a longer-lived **refresh token** (default `7d`) stored only as an
   `HttpOnly`, `SameSite=Lax`, path-scoped cookie (`refresh_token` on
   `/api/v1/auth`).
2. Refresh rotates the cookie: the previous token hash is invalidated; presenting a
   already-rotated token triggers **reuse detection** and revokes the token family.
3. Logout clears the cookie and marks the family revoked in Redis/PostgreSQL so stolen
   refresh cookies cannot mint new access tokens.

### CSRF & origin guards

State-changing auth/board routes require the custom header
`X-Requested-With: XMLHttpRequest` (double-submit style for SPA XHR) plus CORS
allow-listing of `CORS_ORIGIN`. Cookies alone are insufficient to mutate state from a
cross-site form.

### Role permission matrix

Roles are ranked `OWNER > EDITOR > COMMENTER > VIEWER`. Shared helpers
(`canWriteDocument`, `canComment`, `roleAtLeast`) and Nest `BoardRoleGuard` /
WebSocket frame filters enforce the same rules on REST and CRDT paths.

| Capability | OWNER | EDITOR | COMMENTER | VIEWER |
| --- | --- | --- | --- | --- |
| Read board / receive Yjs sync | ✓ | ✓ | ✓ | ✓ |
| Mutate durable Y.Doc elements | ✓ | ✓ | ✗ | ✗ |
| Create / resolve comments | ✓ | ✓ | ✓ | ✗ |
| Invite / change member roles | ✓ | ✗ | ✗ | ✗ |
| Delete board / transfer ownership | ✓ | ✗ | ✗ | ✗ |
| Mint share links (≤ EDITOR) | ✓ | ✗ | ✗ | ✗ |

A Viewer that injects a crafted binary update is rejected server-side even if the
client UI is bypassed.

## 5. Real-Time Distributed Sync & Offline Resilience (Phase 4)

### Binary sync handshake

Clients never put long-lived JWTs in the WebSocket URL. The SPA first obtains a
**single-use WS ticket** over HTTPS, then opens `/ws/boards` and runs the standard
Yjs sync step 1/2 exchange (`encodeStateVector` → missing updates → incremental
`Y.encodeStateAsUpdate` frames). Awareness frames share the same socket.

### Horizontal fan-out

NestJS collab instances are stateless. Each board room publishes CRDT and awareness
payloads on Redis pub/sub channels; subscribers skip their own `instanceId` to prevent
echo loops. Document size and per-socket token buckets (`capacity 120`, refill
120/s) bound abuse.

### Persistence debounce

Dirty boards flush compacted `Y.encodeStateAsUpdate` binaries to PostgreSQL with a
**3 s debounce** and a **15 s hard ceiling** during continuous drawing. A Redis lock
(`PERSIST_LOCK_TTL_MS = 10_000`) plus `stateVersion` prevents two instances from
clobbering a newer snapshot. Leaving a room or shutting down forces `flushNow`.

### Offline merge

Clients persist the local `Y.Doc` with `y-indexeddb`. On reconnect, sync step 1/2
merges offline updates with the server snapshot without last-write-wins loss; user-scoped
`UndoManager` origins keep undo stacks from undoing a peer's work.

### Latency targets vs measured

Requirements call for < 60 ms p95 cursor sync under 25 editors. **No live multi-instance
latency capture was run here** (Docker Hub 403 blocked Postgres/Redis/MinIO). Treat the
SLA as the design target until the load harness in `tests/load/collab-stress.js` can
execute against a healthy stack.

## 6. Advanced Features Engineering (Phase 5)

### Smart connectors

Arrow elements carry optional `startBinding` / `endBinding` (`elementId` + anchor).
Shared geometry (`anchorPoint`, `nearestAnchor`, `computeElbowPoints`) and the canvas
`snapEndpoint` / `recomputeBoundArrows` helpers rebind elbows when either endpoint shape
moves, so connectors stay attached without per-frame REST writes.

### Presentation & comments

Follow-Me camera sync and threaded `BoardComment` rows are modeled in Prisma and
surfaced through collab hooks (`useComments`, presence stores). Camera follow is an
awareness/channel concern so it does not pollute the durable CRDT document.

### Version history

Named `BoardSnapshot` rows store full binary CRDT states. Restore hydrates a new
document version non-destructively (point-in-time) rather than mutating audit history.

### Export & uploads

Export targets High-DPI PNG (Konva `toDataURL`), pure vector SVG, and PDF (`jspdf`).
Uploads are capped at 5 MiB, sniffed with magic bytes (`file-type`), re-encoded through
Sharp (max dimension 8192), and stored in MinIO/S3 — never serving attacker-controlled
SVG/script payloads raw. **End-to-end export timing was not measured** without a running
board page + object store.

## 7. Security Hardening & OWASP Threat Model (Phase 6)

| Threat Category | Attack Vector | Mitigation Implemented | Commit / area | Verification |
| --- | --- | --- | --- | --- |
| Broken Access Control | Viewer sends crafted Yjs binary update over WS | Server-side Yjs frame inspection + role re-check + Redis revocation | `security(ws)` / collab RBAC filter | Unit tests + Playwright (when infra available) |
| Credential Stuffing | Brute-force login / token theft | Argon2id + Redis sliding-window rate limit + refresh-token reuse detection | `security(auth)` / rate-limit module | Supertest (CI job when Hub reachable) |
| XSS / Script Injection | Malicious SVG upload or text payload | Magic-byte check + Sharp re-encode + DOMPurify + strict CSP / `frame-ancestors 'none'` | `security(uploads)` + Nginx headers | Unit tests + header scan |
| DoS / Resource Exhaustion | WebSocket frame flood or huge CRDT payload | WS `maxPayload` (default 1 MiB) + per-socket token bucket + Nginx 12 r/s `/api/` zone | `security(rate-limit)` | k6 / `collab-stress.js` (**not run** — Hub 403) |
| CSRF & Clickjacking | Cross-site cookie abuse / framing | `SameSite=Lax`, Origin/CSRF header guard, `X-Frame-Options: DENY` | `security(http)` | Automated security check in CI |
| Supply Chain & Container | Vulnerable deps or root container breakout | `pnpm audit`, Dependabot, Trivy FS scan, non-root `USER node` / nginx uid 101, multi-stage images | `security(supply-chain)` / Dockerfiles | GitHub Actions `security` + `docker` jobs (workflow present; local Hub pulls blocked) |

Defense-in-depth layers: browser CSP → Nginx edge headers → Nest Helmet/guards →
WS payload limits → Prisma typed access → non-root containers on an `internal: true`
data network.

## 8. Testing, Load Benchmarks & Production Readiness (Phase 7)

### Unit & integration

- Shared package: geometry, connector math, Zod schemas, RBAC helpers (committed unit
  suite under `packages/shared/test`).
- Server: Jest + Supertest configured; API integration expects Postgres/Redis service
  containers in CI.
- Web: Vitest configured (`--passWithNoTests` until canvas harness tests land).

**Local status (2026-11-21):** Docker Hub 403 prevents pulling `postgres:16-alpine`,
`redis:7-alpine`, and `minio/minio`. Integration, Playwright E2E, and the 25-client load
harness are therefore **documented as un-executed**, not green.

### Multi-user E2E (Playwright)

`tests/e2e` seeds Owner/Editor/Viewer contexts, mints single-use WS tickets, and asserts
client-side Yjs state (IndexedDB / in-memory) with a server observer as oracle. Cross-
browser (`E2E_CROSS_BROWSER=1`) is optional. **Result: not run in this environment.**

### 25-user load harness (synthetic targets)

`tests/load/collab-stress.js` is designed for 25 sockets, 20 Hz awareness, concurrent
shape mutations, and SHA-256 canonical state-hash convergence. Until Hub access is
restored, treat the following as **design targets / synthetic placeholders**, not
measured live numbers:

| Metric | Target / synthetic placeholder |
| --- | --- |
| Clients | 25 simultaneous WS sessions |
| Awareness rate | 20 Hz outbound / ≤ 30 Hz design budget |
| p50 sync latency | < 30 ms (target) |
| p95 sync latency | < 60 ms (target) |
| CRDT state-hash convergence | 100% of clients identical (pass criterion) |
| Peak process RSS / CPU | _record after first successful run_ |
| DB writes/sec during draw | bounded by 3 s debounce / 15 s ceiling |

### Production topology

Root `docker-compose.prod.yml` orchestrates `nginx` (only published 80/443), `web`
(`apps/web/Dockerfile` → unprivileged nginx), `server` (`apps/server/Dockerfile` →
`USER node` + `dumb-init`), `postgres`, `redis`, and `minio`. Networks: `edge` for
proxy↔app, `data` (`internal: true`) for app↔stores. Healthchecks, restart policies,
and bounded JSON logs are defined. Root `.dockerignore` keeps `node_modules`, `dist`,
`.git`, `.env`, `coverage`, and `.turbo` out of build contexts.

### CI readiness

`.github/workflows/ci.yml` defines quality (lint/typecheck/build), tests (with service
containers), security (`pnpm audit`, Trivy, advisory Gitleaks), and Docker image build
jobs. The workflow is present and ready; **do not treat the README CI badge as proof of
a green `main` run** until Actions has executed successfully against a Hub-reachable
runner.
