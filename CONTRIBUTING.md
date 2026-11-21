# Contributing to SyncBoard

## Setup

1. Install Node 22, pnpm 10 and Docker with Compose.
2. `pnpm install`
3. `cp .env.example .env` and replace placeholders with local development values.
4. `docker compose up -d` and `pnpm dev`.

## Branching

- Work from `main` via short-lived branches: `feat/<slug>`, `fix/<slug>`, `security/<slug>`.
- Keep commits atomic and buildable. Never mix features, security fixes and refactors.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(canvas): add smart connector anchoring`.

## Before opening a PR

- [ ] `pnpm lint && pnpm typecheck && pnpm build && pnpm test` pass.
- [ ] New behaviour has unit or E2E tests.
- [ ] `docs/ENGINEERING_REPORT.md` updated for architectural/security changes.
- [ ] No secrets, `.env` files, generated artifacts or debug logs are included.
- [ ] PR description explains what changed, why, and how it was verified.

Reviews require one approval and a green CI run. Security changes require two approvals.
