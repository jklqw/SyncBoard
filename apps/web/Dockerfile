# Multi-stage web image. Build from the monorepo root:
#   docker build -f apps/web/Dockerfile -t syncboard-web .
# Root .dockerignore excludes node_modules, dist, .git and .env.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @syncboard/shared build \
 && pnpm --filter web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY --from=builder --chown=101:101 /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx/web.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/health/web >/dev/null || exit 1
