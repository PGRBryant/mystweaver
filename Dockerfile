# syntax=docker/dockerfile:1
# Multi-stage build for the Mystweaver API server (monorepo)

###############################################
# Stage 1: deps — install all workspace deps  #
###############################################
FROM node:20.18-alpine3.21 AS deps
WORKDIR /app

# Copy root manifests first for better layer caching
COPY package.json package-lock.json ./

# All workspace manifests must be present so npm ci can resolve the full
# workspace graph (root package.json declares workspaces: [apps/*, packages/*])
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/
COPY packages/sdk-js/package.json  packages/sdk-js/

RUN npm ci --include=dev

###############################################
# Stage 2: build — compile TypeScript         #
###############################################
FROM node:20.18-alpine3.21 AS build
WORKDIR /app

# Reuse installed modules from deps stage
COPY --from=deps /app/node_modules            ./node_modules

# npm needs root + workspace manifests to resolve the workspace graph
COPY package.json package-lock.json ./
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/
COPY packages/sdk-js/package.json  packages/sdk-js/

# Copy source files
COPY tsconfig.json ./
COPY config/       ./config/
COPY apps/api/     ./apps/api/

RUN npm run build --workspace=@mystweaver/api

###############################################
# Stage 3: runner — lean production image     #
###############################################
FROM node:20.18-alpine3.21 AS runner
ENV NODE_ENV=production
WORKDIR /app

# dumb-init ensures proper signal forwarding and zombie reaping
RUN apk add --no-cache dumb-init

# Non-root user
RUN addgroup -S mystweaver && adduser -S mystweaver -G mystweaver

# Re-install production-only dependencies
# All workspace manifests must be present for npm to resolve the workspace graph
COPY package.json package-lock.json ./
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/
COPY packages/sdk-js/package.json  packages/sdk-js/
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=build /app/apps/api/dist ./apps/api/dist

RUN chown -R mystweaver:mystweaver /app
USER mystweaver

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3000/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
