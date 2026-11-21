# Docker & production topology

Everything in this directory is deployment-only; no application source lives here.

## Application images & Compose

Canonical build files live at `apps/web/Dockerfile` and `apps/server/Dockerfile` (adapted from
the templates in this directory). Production orchestration is the root
`docker-compose.prod.yml` (mirrored from `docker/docker-compose.prod.yml`). A root
`.dockerignore` excludes `node_modules`, `dist`, `.git`, `.env`, `coverage`, and `.turbo`.

All Dockerfiles expect the **repository root** as build context because pnpm workspaces resolve
siblings (`packages/shared`) from there:

```bash
docker build -f apps/web/Dockerfile    -t syncboard-web .
docker build -f apps/server/Dockerfile -t syncboard-server .
docker build -f docker/nginx/Dockerfile -t syncboard-nginx docker/nginx
```

## Images

| Image    | Base                                                         | Runtime user  | Notes                                                                                                                 |
| -------- | ------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `web`    | `node:22-alpine` → `nginxinc/nginx-unprivileged:1.27-alpine` | uid 101       | Vite static build only; SPA fallback in `docker/nginx/web.conf`.                                                      |
| `server` | `node:22-alpine`                                             | `node`        | Prisma Client generated at build time, dev deps pruned, `dumb-init` PID 1, stdout logging, read-only-root compatible. |
| `nginx`  | `nginx:1.27-alpine`                                          | nginx workers | TLS terminator / edge proxy; only service publishing host ports.                                                      |

## Reverse proxy

`docker/nginx/nginx.conf` provides:

- HTTP/2 (`http2 on;`) and `server_tokens off`.
- WebSocket upgrade for `/ws/` with `Upgrade`/`Connection` headers and 1-hour read/send timeouts.
- gzip for text assets; Brotli is an optional drop-in (`brotli.conf.disabled`) because the stock
  nginx image lacks `ngx_brotli` — copy it to `/etc/nginx/brotli.d/brotli.conf` in a module-enabled image.
- `client_max_body_size 6m` (5 MiB upload cap plus multipart overhead).
- Security headers on every response: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, strict CSP with `frame-ancestors 'none'`, plus `base-uri`/`form-action` locks.
- A 12 r/s per-IP zone for `/api/` (application-layer auth/rate-limit rules remain authoritative).
- `/health/nginx` liveness endpoint and a commented TLS server block.

To terminate TLS in this container, mount certificates into `docker/nginx/certs/` (gitignored)
and enable the commented `443` server block. Otherwise terminate TLS at your load balancer and
keep the internal network private.

## Production Compose stack

```bash
cp .env.example .env        # replace every placeholder with a real secret
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

`edge` carries Nginx ↔ web/server traffic; `data` is `internal: true` and carries only
server ↔ PostgreSQL/Redis/MinIO traffic. Only Nginx publishes `80`/`443`. Every service has a
healthcheck, restart policy and bounded JSON logs. Run Prisma migrations as a one-off before the
first release:

```bash
docker compose -f docker-compose.prod.yml run --rm server \
  node apps/server/node_modules/.bin/prisma migrate deploy
```
