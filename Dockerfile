# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for React + Vite app served by nginx

# ── Stage 1: Build ──────────────────────────────────────────────
# Debian-based (glibc) image, Node 22 — matches the environment where the build
# was verified to succeed. Avoids Alpine/musl + npm optional-dep issues with the
# Rollup/esbuild native binaries that made `npm run build` fail in the container.
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies. The lockfile is generated on Windows and therefore lacks
# the Linux/musl platform binaries that Rollup needs (@rollup/rollup-linux-x64-musl).
# `npm ci` would follow that lockfile and miss them, so `vite build` would fail.
# Removing the lockfile lets npm resolve the correct Linux binaries on this platform.
COPY package.json ./
RUN npm install
# Guarantee the platform-specific Rollup native binary is present
# (works around npm optional-dependencies bug npm/cli#4828).
RUN node -e "require('@rollup/rollup-linux-x64-gnu')" 2>/dev/null || npm install @rollup/rollup-linux-x64-gnu --no-save

# Copy source
COPY . .

# Build the app with PocketBase URL injected at build time
ARG VITE_PB_URL
ENV VITE_PB_URL=${VITE_PB_URL}
RUN npm run build

# ── Stage 2: Serve with nginx ────────────────────────────────────
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8081 inside the container
EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]
