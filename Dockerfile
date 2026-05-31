# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for React + Vite app served by nginx

# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with a clean, deterministic install (npm ci).
# Fall back to a fresh install if the lockfile is out of sync. This avoids the
# broken/partial dependency trees (e.g. missing rollup/esbuild platform binaries
# or ts-interface-checker) that can make `npm run build` fail in the container.
COPY package.json package-lock.json* ./
RUN npm ci || (rm -rf node_modules package-lock.json && npm install)

# Copy source
COPY . .

# Build the app with PocketBase URL injected at build time
ARG VITE_PB_URL
ENV VITE_PB_URL=${VITE_PB_URL}
RUN npm run build

# ── Stage 2: Serve with nginx ─────────────────────