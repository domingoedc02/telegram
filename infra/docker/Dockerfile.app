# syntax=docker/dockerfile:1
#
# Minimal placeholder image, added to unblock TG-6's CI pipeline (build-image/
# scan/push jobs need something to build and scan). TG-8 (production deploy on
# Dokploy, not yet planned) owns the real, slim version of this file per
# spec/file-structure/spec/operations: a runtime stage that copies only
# apps/server/dist + prod node_modules + the static apps/web/dist build, not
# the whole repo. This version is correct but not lean — it carries the full
# monorepo (source + dev deps) into the runtime stage for simplicity, since
# there is no real server/app code to run yet (apps/server/src/main.ts is
# still TG-3's placeholder).

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Install dependencies first (cached separately from source changes) — only
# the manifests each workspace needs to resolve its `workspace:*` deps.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Build every workspace: packages/shared (tsc), apps/server (tsc), apps/web
# (tsc --noEmit + vite build).
FROM deps AS build
COPY . .
RUN pnpm build

# Runtime: Node only, no pnpm/corepack needed to just run the compiled server.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "apps/server/dist/main.js"]

# KNOWN GAP (pre-existing, not introduced by this file): running this image
# with `docker run` currently fails at startup. `node apps/server/dist/main.js`
# imports `@tg/shared`, whose package.json `main`/`types` point at
# `./src/index.ts` (source, for dev-time resolution by tsx/Vite) rather than a
# compiled `dist/index.js` — plain Node can't execute that at runtime. This
# doesn't block CI (`docker build`/`trivy image`/`docker push` never run the
# container), but it must be fixed — likely by giving packages/shared a real
# build + a `main`/`exports` field pointing at its compiled output — before
# TG-8 (production deploy) can replace this placeholder with a working image.
