# syntax=docker/dockerfile:1.7

# =============================================================
# Telerady frontend — multi-stage build
#
#   Stage 1 (deps):    install all deps to compile.
#   Stage 2 (build):   `ng build --configuration=production` →
#                      dist/telerady-front/browser.
#   Stage 3 (runtime): nginx:alpine that serves the SPA + SPA
#                      fallback for client routes, gzip on.
#
# The runtime image is ~50 MB and contains no JS source, no
# node_modules, no .env file. API base URL is baked at build time
# via `apps/front/src/environments/environment.prod.ts`; if it ever
# needs to be flipped at deploy time we will switch to runtime env
# substitution via `envsubst` in the nginx entrypoint.
# =============================================================

ARG NODE_VERSION=22-alpine
ARG NGINX_VERSION=1.27-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY apps/front/package.json apps/front/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/front/. .
RUN npm run build

FROM nginx:${NGINX_VERSION} AS runtime
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/front/nginx.conf /etc/nginx/conf.d/telerady.conf
COPY --from=build /app/dist/telerady-front/browser /usr/share/nginx/html
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/healthz || exit 1

# nginx:alpine runs as root by default to bind low ports; we listen
# on 8080 and drop privileges so the runtime stays non-root.
USER nginx
CMD ["nginx", "-g", "daemon off;"]
