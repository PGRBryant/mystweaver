# syntax=docker/dockerfile:1
# Multi-stage build for the Labrats API server (monorepo)

###############################################
# Stage 1: deps — install all workspace deps  #
###############################################
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root manifests first for better layer caching
COPY package.json package-lock.json ./

# Copy each workspace's package.json so npm ci resolves the workspace graph
COPY apps/api/package.json        apps/api/
COPY packages/sdk-js/package.json packages/sdk-js/

RUN npm ci --include=dev

###############################################
# Stage 2: build — compile TypeScript         #
###############################################
FROM node:20-alpine AS build
WORKDIR /app

# Reuse installed modules from deps stage
COPY --from=deps /app/node_modules            ./node_modules
COPY --from=deps /app/apps/api/node_modules   ./apps/api/node_modules/

# Copy source files
COPY tsconfig.json ./
COPY config/       ./config/
COPY apps/api/     ./apps/api/

RUN npm run build --workspace=@labrats/api

###############################################
# Stage 3: runner — lean production image     #
###############################################
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# dumb-init ensures proper signal forwarding and zombie reaping
RUN apk add --no-cache dumb-init

# Non-root user
RUN addgroup -S labrats && adduser -S labrats -G labrats

# Re-install production-only dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=build /app/apps/api/dist ./apps/api/dist

RUN chown -R labrats:labrats /app
USER labrats

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
