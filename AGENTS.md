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
- Conventional commits only; local `type-enum` allows `build`, `chore`, `ci`, `docs`, `feat`, `fix`,
  `perf`, `refactor`, `revert`, `style`, `test`. `security` is rejected by commitlint — use `fix`
  for security patches unless the config is updated.
- One concern per commit, matching GUIDE.md commit numbers exactly where practical.
- UI: warm paper `#FAF9F6`, charcoal ink `#18181B`, cobalt `#2563EB`, hairline borders, no AI-slop gradients.
- Never commit secrets; only `.env.example` with placeholders.
- Update this file before handing off or ending a long session so the next agent can continue.

## Git state (as of 2026-11-22 end of session)

```
747c7cc fix(collab): sanitize viewer presence on the server
dfc5ab4 fix(collab): hide viewer cursors and follow presenters immediately
a18884a feat(canvas): color code syntax in blocks and editor
88d6274 docs(memory): include latest verification commit in state log
5bd66ed docs(memory): record canvas and sharing verification
016b0a6 feat(share): add no-login watch mode and edit grants
```

Worktree is clean after these commits. All checks green: `pnpm lint`, `pnpm typecheck`,
`pnpm build`, `pnpm test` (11 shared + 3 web + 1 server unit tests).

## Git state (historical, 2026-11-21 evening)

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

| Area                                              | Status         | Path notes                                                                                                                                                                |
| ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web` scaffold, UI kit, auth/dashboard pages | partial        | Has Vite/Tailwind, UI primitives, Login/Register, Dashboard, ShareModal                                                                                                   |
| Canvas engine                                     | **incomplete** | Has layers/shapes/utils/stores but **MISSING** BoardPage, CanvasStage, ToolDock, tools/handlers, selection/transformer, export feature                                    |
| Collab client                                     | partial        | Yjs provider, awareness, offline IndexedDB hooks exist; not fully wired to a board page                                                                                   |
| `apps/server` Nest modules                        | partial        | auth/boards/permissions/collab/audit + common guards; **MISSING** `main.ts`, `app.module.ts`, health, uploads module                                                      |
| Infra/tests/docs                                  | partial        | nginx + CI + Playwright/k6 stubs present; **done:** `apps/*/Dockerfile`, root `docker-compose.prod.yml`, `.dockerignore`, README polish; Hub 403 still blocks image pulls |
| Engineering report §§3–8                          | filled (est.)  | §§3–8 written; FPS/load labeled estimated/synthetic pending live runs                                                                                                     |

## Progress journal

| Date       | Phase                        | Status                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | 0                            | done                          | Commits 1–4: monorepo, specs/tooling/husky, docker-compose dev infra.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-21 | 1                            | done                          | Commits 5–7: shared Zod schemas + geometry, Prisma schema + offline-generated init migration, report §2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-21 | unit tests                   | done                          | Shared geometry/schema/RBAC unit tests committed (`4d108bf`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-21 | 2–7                          | **code complete, atomicized** | All WIP committed in 16 thematic commits (8 new + prior 8). Missing server bootstrap (main/app module/health/collab.module/uploads), contract mismatches (GET /boards/:id, comment/member/snapshot DTOs, share URL), WS framing bug, and Y.Doc base/props→flat schema mismatch all fixed. `pnpm install` took ~28 min (registry very slow). **Verified:** shared+server+web `tsc` clean, `pnpm build` green (web+server+shared), `pnpm test` green (10 shared unit tests; server/web have no tests yet). **NOT verified:** `pnpm lint` (@eslint/js was missing from root devDeps — install in progress), integration/E2E/load (Docker Hub 403 still blocks Postgres/Redis/MinIO).                                                                                                                                                             |
| 2026-11-22 | bugfixes                     | done                          | Four commits after `dae432f`: `7520428` invite links survive login/register and WS role rechecks (added `GET /boards/:id/share-link`, share token in WS ticket/gateway, full-path redirect state), `d5607bb` sync-step1 no longer double-unwraps the classified state vector, `c4c3e59` pen stays active after each stroke, `6b36cf4` dashboard three-dot menu no longer clipped by `overflow-hidden` on the board card. Live Chrome verified: link-only guest joins `as VIEWER` and stays `Connected`, pen still `aria-pressed=true` after two strokes, all six menu items hit-testable. `pnpm lint/typecheck/build/test` all green; worktree clean.                                                                                                                                                                                         |
| 2026-11-22 | canvas/share                 | done                          | Three commits (`86b244d`, `8959338`, `016b0a6`). Root cause of typing/move-disappearance found: `upsertElements` iterated an unintegrated `Y.Map`, which reports no keys, so every update erased all element fields. Replaced with plain encoded field objects + stale empty-map cleanup. Also restored selected-shape handlers/focus, added finite transform guards, bounded WebP inline image fallback when MinIO is unavailable, collaborative code blocks, no-login watch links with watcher cursors/selections/avatars hidden, explicit edit grants for registered users, and live role-upgrade frames. Browser-verified sticky/code typing, rectangle move persistence, image fallback, watch link read-only UI, edit-grant UI + API membership, and WS `role_upgraded` frame. `pnpm lint/typecheck/build/test` all green.              |
| 2026-11-22 | syntax/presence/presentation | done                          | Three commits (`a18884a`, `dfc5ab4`, `747c7cc`). Added dependency-free code tokenizer + token colors for on-canvas code and the transparent editor overlay; client stops broadcasting viewer cursors and the server strips `cursor`/selection and stamps the authenticated role into awareness frames; presenting now publishes the current camera in the same awareness frame and followers apply it immediately (including when both tabs use the same account). Live Chrome verified: editor shows all five palette colors with hidden textarea text and canvas pixels match the palette; raw WS viewer state arrives as `role: VIEWER` with no cursor and empty selection; owner zoom 146% → viewer 146% and `Following` true immediately after Present. `pnpm lint/typecheck/build/test` all green (11 shared + 3 web + 1 server tests). |

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
   - [x] Verify: lint/typecheck/build/test all green (`@eslint/js` installed at the root).
   - [x] Atomicize WIP → 16 thematic commits (`41c1917`…`e835aea`); GUIDE's 42-commit
         granularity was collapsed because WIP arrived as one monolithic blob — App.tsx
         and CanvasStage.tsx span multiple GUIDE commits and can't be split cleanly.
   - [x] `@eslint/js` installed at the root; `pnpm lint` is green.
   - [ ] Optional follow-ups: server awareness (`yjs-protocol.spec.ts`) and web tokenizer
         (`codeHighlight.test.ts`) unit specs exist; integration (supertest), Playwright/k6
         E2E and load suites still can't run without Docker Hub images.
2. Run typecheck/build/unit tests; mark integration/E2E as blocked by Docker Hub 403 if still unavailable.
3. DONE 2026-11-22: started local Postgres/Valkey from RPMs, fixed dev runtime DI issues, verified
   health endpoints + API smoke test + web server; committed `fix(api)` for the runtime fixes.
4. DONE 2026-11-22: fixed element-field loss on every CRDT update (typing/move disappearance),
   restored focus/selection handlers, added WebP inline image fallback, collaborative code blocks,
   no-login watch links with hidden watcher pointers, and explicit registered-user edit grants.
   Server/web unit specs now exist; still open: supertest integration and Docker-based E2E/load
   runs (Docker Hub 403).
5. DONE 2026-11-22: added colored code syntax, hidden viewer cursors (client + server), and
   immediate presentation viewport sync; browser-verified all three. All checks green.

### Status note — docs/docker (2026-11-21, infra/docs agent)

- Adapted templates → `apps/web/Dockerfile`, `apps/server/Dockerfile`; root
  `docker-compose.prod.yml` + `.dockerignore` added; `docs/ENGINEERING_REPORT.md` §§3–8
  filled with honest estimated/synthetic metrics; README lightly polished (no fake CI-green).
- Did **not** touch `apps/web/src/features/canvas` or `apps/server/src`. Image builds /
  `compose up` still blocked by Docker Hub 403 for base/data images — replace synthetic
  FPS and 25-user latency rows after first successful live run.

## Runtime verification (2026-11-22)

- Docker Hub/quay/ghcr all return 403 in this environment and Docker Desktop daemon is not running.
  Workaround used: downloaded Fedora RPMs with `dnf download` (no root needed), extracted to
  `/tmp/opencode/runtime` with `rpm2cpio | cpio -idmu`, and ran:
  - `LD_LIBRARY_PATH=/tmp/opencode/runtime/usr/lib64` + `initdb -D /tmp/opencode/pgdata -U syncboard --auth=trust --no-locale`
  - `pg_ctl -D /tmp/opencode/pgdata -o '-p 5432 -k /tmp/opencode -h 127.0.0.1' -l /tmp/opencode/pg.log start`
  - `valkey-server --port 6379 --requirepass syncboard --appendonly no --save '' --daemonize yes --dir /tmp/opencode/valkey`
    (Valkey is Redis-protocol compatible and satisfies ioredis.)
  - `prisma migrate deploy` + `prisma generate` succeeded against local PostgreSQL 18.
- **Runtime bugs found and fixed while starting the server:**
  1. `apps/server` dev script used `tsx watch`, which does not emit TypeScript decorator metadata;
     Nest DI failed with `UndefinedDependencyException` for `AuthService`. Changed to
     `node --watch --require ts-node/register src/main.ts` (ts-node emits decorator metadata).
  2. `JwtAuthGuard` is used in `UploadsModule`/`PermissionsModule`/`BoardsModule` but `JwtService`
     was only provided by `AuthModule`. Registered `JwtModule.register({ global: true })` in `AppModule`.
- **Live verification:** server boots, `/api/v1/health` and `/api/v1/health/ready` return 200
  (postgres/redis ok), register → create board → list boards smoke test succeeded, web dev server
  returns 200 on `http://localhost:5173/`. `pnpm typecheck`, `pnpm build`, `pnpm test` all green
  (10 shared unit tests).
- Long-running processes must be started detached with `setsid nohup ... & disown`; the harness kills
  background shell commands after their timeout. Logs: `/tmp/opencode/server.log`, `/tmp/opencode/web.log`.
- **Blank board page fix (2026-11-22):** headless Chrome reproduction showed React's
  `getSnapshot should be cached` error → `Maximum update depth exceeded`. Four canvas components
  used Zustand selectors returning a new `{x,y,scale}` object on every call. Replaced with primitive
  subscriptions + `useMemo` in `CanvasStage`, `CommentsPanel`, `TextEditorOverlay`. Also wrapped
  `CollabService.handleMessage` in try/catch so a malformed CRDT frame can't crash the API process.
  Verified on a newly created board: 4 canvas layers mounted, status `Connected`, no exceptions;
  `pnpm lint/typecheck/build/test` all still green.
- **Canvas/share verification (2026-11-22):** on a fresh board, headless Chrome created a sticky
  note and typed `typed note works`, created a code block and typed `const answer = 42;`, drew and
  moved a rectangle to `{x:224,y:324}`, and uploaded an image that fell back to a bounded WebP data
  URL; a separate Yjs observer saw all four elements with their fields intact. Guest watch URL
  (`?token=...&watch=1`) showed the read-only banner and `Connected` with all editing tools disabled.
  Share modal's "Give edit access" granted `EDITOR` to a registered user (confirmed via members API),
  and a connected WS client received `{"type":"role-changed","role":"EDITOR","reason":"role_upgraded"}`.
  Invalid share token → 403, no token → 401, share token → PATCH → 401. All four checks green.
- **Syntax, viewer cursors and presentation follow (2026-11-22):** restarted the API with the new
  awareness sanitizer. Headless Chrome showed all five code-token colors in the editor with
  transparent textarea text, and matching palette pixels on the Konva canvas. A raw WS client using
  a share token (forging `role: EDITOR`, cursor, selection) receives `role: VIEWER`, no `cursor`,
  and an empty `selection`. Two tabs on the same account: owner zoom 100% → 146%, then toggling
  Present moved the watcher 100% → 146% within ~1.2 s with `Following` visible. That last fix
  required removing the `presenter.user.id !== presenceUser.id` guard because `usePresence`
  already filters the local client. `pnpm lint/typecheck/build/test` green (11 shared + 3 web + 1
  server tests).

## Handoff instructions for next agent

1. Read this file + `GUIDE.md` §6 commit plan.
2. Prefer completing missing runtime code over rewriting existing modules.
3. Do not claim Docker/E2E/integration pass without running them.
4. Update this Progress journal + Remaining work before ending your session.
