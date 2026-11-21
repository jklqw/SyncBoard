# SyncBoard — Agent Working Memory

This file is a living log for AI agents working in this repository. Read it first, update it last.
It records what has been built, why decisions were made, what is still missing, and how to verify.

## Mission

Implement the complete **SyncBoard** production-grade collaborative whiteboard described in `GUIDE.md`:
7 phases, 42 atomic Conventional Commits, clean portfolio-ready repository.

## Environment facts (verified 2026-11-21)

- Working dir: `/home/vbnm/SyncBoard` (was empty except `GUIDE.md`; `git init -b main` done).
- Node v22.22.2; pnpm 10.34.9 installed locally at `/home/vbnm/.local/bin/pnpm` (corepack/pnpm were
  initially absent; installed with `npm install -g --prefix /home/vbnm/.local pnpm@10`).
- Docker 29.9.2 available; Docker Compose v5.6.0 exists.
- npm registry reachable but slow (frequent 10–30 s metadata timeouts); `.npmrc` raises concurrency/retries.
- Docker Compose `up -d` FAILS: Docker Hub returns 403 for `postgres:16-alpine`, `redis:7-alpine`,
  `minio/minio`. No local DB/Redis/MinIO available. Integration and E2E runs must be reported as
  un-executed, not silently claimed as passing.
- pnpm 10 ignores install scripts unless allowlisted; `pnpm-workspace.yaml` has `onlyBuiltDependencies`
  for Prisma, esbuild, Sharp, Argon2 etc.
- PATH note: use `/home/vbnm/.local/bin/pnpm` (or ensure `~/.local/bin` is on PATH).

## Conventions

- TypeScript strict everywhere; `pnpm` workspaces + Turborepo.
- Conventional commits only (`feat`, `fix`, `perf`, `security`, `refactor`, `test`, `docs`, `chore`, `ci`).
- One concern per commit, matching GUIDE.md commit numbers exactly where practical.
- UI: warm paper `#FAF9F6`, charcoal ink `#18181B`, cobalt `#2563EB`, hairline borders, no AI-slop gradients.
- Never commit secrets; only `.env.example` with placeholders.
- Update this file before handing off or ending a long session so the next agent can continue.

## Git state (as of 2026-11-21 evening)

**Committed (Phase 0–1 + shared unit tests):** commits 1–7 + `test(unit): add shared geometry...`

```
4d108bf test(unit): add shared geometry, connector, schema, and RBAC unit tests
f33e82e docs(report): document domain schemas, fractional indexing, and database persistence model
c27c413 feat(db): design Prisma schema for users, refresh tokens, boards, RBAC, snapshots, and audit logs
aa075ff feat(shared): define canonical whiteboard element schemas, RBAC roles, and geometry helpers
b212c62 chore(infra): add local Docker Compose stack for PostgreSQL, Redis, and MinIO
f62244f chore(tooling): configure strict TypeScript, ESLint, Prettier, Husky, and commitlint
a150d07 docs(specs): add requirements spec, security policy, and engineering report scaffold
fbfa8c7 chore(repo): initialize pnpm Turborepo workspace, git hygiene, and env template
```

**Uncommitted WIP (parallel workstreams — NOT yet split into GUIDE commits 8–42):**

| Area | Status | Path notes |
| --- | --- | --- |
| `apps/web` scaffold, UI kit, auth/dashboard pages | partial | Has Vite/Tailwind, UI primitives, Login/Register, Dashboard, ShareModal |
| Canvas engine | **incomplete** | Has layers/shapes/utils/stores but **MISSING** BoardPage, CanvasStage, ToolDock, tools/handlers, selection/transformer, export feature |
| Collab client | partial | Yjs provider, awareness, offline IndexedDB hooks exist; not fully wired to a board page |
| `apps/server` Nest modules | partial | auth/boards/permissions/collab/audit + common guards; **MISSING** `main.ts`, `app.module.ts`, health, uploads module |
| Infra/tests/docs | partial | nginx + CI + Playwright/k6 stubs present; **done:** `apps/*/Dockerfile`, root `docker-compose.prod.yml`, `.dockerignore`, README polish; Hub 403 still blocks image pulls |
| Engineering report §§3–8 | filled (est.) | §§3–8 written; FPS/load labeled estimated/synthetic pending live runs |

## Progress journal

| Date | Phase | Status | Notes |
| --- | --- | --- | --- |
| 2026-11-21 | 0 | done | Commits 1–4: monorepo, specs/tooling/husky, docker-compose dev infra. |
| 2026-11-21 | 1 | done | Commits 5–7: shared Zod schemas + geometry, Prisma schema + offline-generated init migration, report §2. |
| 2026-11-21 | unit tests | done | Shared geometry/schema/RBAC unit tests committed (`4d108bf`). |
| 2026-11-21 | 2–7 | **in progress** | Uncommitted WIP from parallel agents. Current agent: inventory gaps, complete missing canvas/board UI + server bootstrap/uploads, then atomicize into GUIDE commits 8–42. |

## Architecture decisions (ADRs)

- ADR-001: Yjs CRDT (`Y.Doc` + awareness) instead of raw JSON patch broadcasting — mathematically
  convergent concurrent edits, offline merge, and scoped UndoManager.
- ADR-002: Konva 4-layer stage + rbush spatial index — viewport culling and isolated repaint.
- ADR-003: NestJS stateless instances + Redis pub/sub bridge + PostgreSQL binary CRDT snapshots.

## Verification commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test
git log --oneline
```

## Remaining work / next steps (ordered)

1. **Finish critical missing app code** — mostly DONE by agent 2026-11-21 late:
   - [x] `apps/server/src/main.ts` + `app.module.ts` (helmet CSP, CORS, cookie-parser,
     ValidationPipe whitelist, WsAdapter, pino redaction, graceful shutdown)
   - [x] `apps/server/src/modules/collab/collab.module.ts` (was imported but missing)
   - [x] `apps/server/src/modules/health/` (`/api/v1/health` + `/ready` PG/Redis checks)
   - [x] `apps/server/src/modules/uploads/` (magic-byte sniff, sharp re-encode, SVG
     DOMPurify, MinIO/S3 PutObject; `file-type` dep removed — manual sniff instead)
   - [x] Canvas: `BoardPage`, `CanvasStage`, `ToolDock`, shapes, layers, transformer,
     spatial index, export — all already existed in WIP
   - [x] Collab provider wired into `/board/:id`; presentation/comments/version UI exist
   - [x] Contract fixes: added `GET /boards/:id`, ws-ticket shareToken passthrough,
     comment `authorName` DTO, flat member DTOs, snapshot `boardId`, share URL `/board/`
   - [x] Fixed `YjsWebSocketProvider` framing (was sending an extra length wrapper the
     server codec doesn't expect) + JSON control frames + multi-message frames
   - [x] Rewrote `useYDoc` to flat per-field Y.Map (was `base`/`props` JSON blobs —
     incompatible with server templates and `replaceBoardState`)
   - [x] Client share-token plumbing (`setShareToken` in api client, `?token=` on
     board routes, live role-changed handling, comment WS → `syncboard:comment` event)
   - [ ] Verify: `pnpm install` (registry very slow — first attempt stalled 38 min,
     retried with `--prefer-offline`), then `pnpm typecheck`/`build`/`lint`/`test`
   - [ ] Atomicize uncommitted WIP into GUIDE commits 8–42 (one concern per commit).
3. Run typecheck/build/unit tests; mark integration/E2E as blocked by Docker Hub 403 if still unavailable.

### Status note — docs/docker (2026-11-21, infra/docs agent)

- Adapted templates → `apps/web/Dockerfile`, `apps/server/Dockerfile`; root
  `docker-compose.prod.yml` + `.dockerignore` added; `docs/ENGINEERING_REPORT.md` §§3–8
  filled with honest estimated/synthetic metrics; README lightly polished (no fake CI-green).
- Did **not** touch `apps/web/src/features/canvas` or `apps/server/src`. Image builds /
  `compose up` still blocked by Docker Hub 403 for base/data images — replace synthetic
  FPS and 25-user latency rows after first successful live run.

## Handoff instructions for next agent

1. Read this file + `GUIDE.md` §6 commit plan.
2. Prefer completing missing runtime code over rewriting existing modules.
3. Do not claim Docker/E2E/integration pass without running them.
4. Update this Progress journal + Remaining work before ending your session.
