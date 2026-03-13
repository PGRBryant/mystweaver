# syntax=docker/dockerfile:1
# Multi-stage build for the Mystweaver Admin UI (monorepo)

###############################################
# Stage 1: deps — install all workspace deps  #
###############################################
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/
COPY packages/sdk-js/package.json  packages/sdk-js/

RUN npm ci --include=dev

###############################################
# Stage 2: build — compile React app          #
###############################################
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/
COPY packages/sdk-js/package.json  packages/sdk-js/

COPY tsconfig.json    ./
COPY config/          ./config/
COPY apps/web/        ./apps/web/

RUN npm run build --workspace=@mystweaver/web

###############################################
# Stage 3: runner — nginx serves static files #
###############################################
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx template (uses envsubst for MYSTWEAVER_API_URL)
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static files
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine image auto-runs envsubst on /etc/nginx/templates/*.template
# and outputs to /etc/nginx/conf.d/ before starting nginx.
