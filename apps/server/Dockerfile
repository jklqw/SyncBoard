# Multi-stage server image. Build from the monorepo root:
#   docker build -f apps/server/Dockerfile -t syncboard-server .
# Root .dockerignore excludes node_modules, dist, .git and .env.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter server...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY . .
RUN pnpm --filter @syncboard/shared build \
 && pnpm --filter server exec prisma generate \
 && pnpm --filter server build \
 && pnpm prune --prod --ignore-scripts

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=builder --chown=node:node /app /app
# Runs as an unprivileged user; all logs go to stdout/stderr and no runtime writes
# are required. If a platform enforces a read-only root filesystem, mount a tmpfs
# at /tmp (Prisma engines may use it for scratch space).
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/health >/dev/null || exit 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/server/dist/main.js"]
