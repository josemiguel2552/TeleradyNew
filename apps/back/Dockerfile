# syntax=docker/dockerfile:1.7

# =============================================================
# Telerady backend — multi-stage build
#
#   Stage 1 (deps):     install ALL deps to compile.
#   Stage 2 (build):    nest build → dist/.
#   Stage 3 (prune):    install ONLY production deps, smaller image.
#   Stage 4 (runtime):  copy dist + production node_modules onto
#                       a slim Node 22 alpine, drop privileges to
#                       UID 1001, expose 3000, run dist/src/main.
#
# The runtime image is ~180 MB and contains no source TS, no
# devDependencies, no .npmrc, no test fixtures. The seed and the
# RLS migration are NOT baked in — they live alongside the deploy
# artefact and are applied by the migrator role separately.
# =============================================================

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY apps/back/package.json apps/back/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/back/. .
RUN npm run build

FROM node:${NODE_VERSION} AS prune
WORKDIR /app
COPY apps/back/package.json apps/back/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Run as a non-root user. node:alpine already ships a `node` user,
# but we want a deterministic UID so the volume permissions match
# whatever the k8s spec uses.
RUN deluser --remove-home node 2>/dev/null || true \
 && addgroup -S -g 1001 telerady \
 && adduser -S -u 1001 -G telerady telerady

COPY --from=prune --chown=telerady:telerady /app/node_modules ./node_modules
COPY --from=build --chown=telerady:telerady /app/dist ./dist
COPY --from=build --chown=telerady:telerady /app/package.json ./package.json

USER telerady
EXPOSE 3000

# Healthcheck hits the public /healthz the API exposes. Use wget
# instead of curl — alpine doesn't ship curl by default and the
# probe should not balloon the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "dist/src/main.js"]
