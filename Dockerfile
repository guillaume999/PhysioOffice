# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for React + Vite app served by nginx

# ── Stage 1: Build ──────────────────────────────────────────────
# Debian-based (glibc) image: avoids Alpine/musl native binary issues with
# Rollup/esbuild that made `npm run build` fail in the container.
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies. The lockfile is generated on Windows and therefore lacks
# the Linux/musl platform binaries that Rollup needs (@rollup/rollup-linux-x64-musl).
# `npm ci` would follow that lockfile and miss them, so `vite build` would fail.
# Removing the lockfile lets npm resolve the correct Linux binaries on this platform.
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Build the app with PocketBase URL injected at build time
ARG VITE_PB_URL
ENV VITE_PB_URL=${VITE_PB_URL}
RUN npm run build

# �