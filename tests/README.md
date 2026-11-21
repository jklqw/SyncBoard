# SyncBoard verification suites

This directory contains the end-to-end and load harnesses that exercise the running stack.
Unit and API integration tests live next to the code they cover (`packages/shared`, `apps/server`)
so they are picked up by `pnpm test` / Turborepo.

## Prerequisites

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

# dev dependencies used by these harnesses (add to the root workspace if missing):
#   pnpm add -Dw @playwright/test yjs y-protocols lib0 ws
```

The REST API, WebSocket gateway, web app and dev infrastructure must be reachable before running
these suites:

```bash
docker compose up -d          # Postgres, Redis, MinIO
pnpm --filter server prisma migrate deploy
pnpm dev                      # Vite :5173 + NestJS :3000
```

If Docker Hub is unreachable in your environment, these suites cannot run; report them as
**not executed** rather than assuming a green result.

## End-to-end tests

```bash
pnpm exec playwright test --config playwright.config.ts
E2E_CROSS_BROWSER=1 pnpm exec playwright test    # add Firefox + WebKit
PW_HEADED=1 pnpm exec playwright test            # watch the collaboration
```

`tests/e2e/helpers.ts` seeds users through the REST API, grants board roles, mints single-use
WebSocket tickets and opens a read-only Yjs observer for deterministic convergence assertions.
It reads the browser's `y-indexeddb` updates when available so assertions are made against the
**client** document, not only against the server.

## Load test

```bash
node tests/load/collab-stress.js
STRESS_DURATION_MS=10000 node tests/load/collab-stress.js   # CI-friendly smoke run
STRESS_BOARD_ID=<uuid> node tests/load/collab-stress.js     # reuse an existing board
```

The harness uses 25 independent WebSocket connections (each with its own single-use ticket),
broadcasts awareness cursors at 20 Hz, creates/moves shapes concurrently and verifies that every
client ends with an identical canonical SHA-256 element-state hash. See the header of
`tests/load/collab-stress.js` for all environment variables.
