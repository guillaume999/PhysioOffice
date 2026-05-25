# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for React + Vite app served by nginx

# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN apk add --no-cache bash curl \
    && curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun

RUN bun install

# Copy source
COPY . .

# Build the app with PocketBase URL injected at build time
ARG VITE_PB_URL
ENV VITE_PB_URL=${VITE_PB_URL}
RUN bun run build

# ── Stage 2: Serve with nginx ────────────────────────────────────
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8081 inside the container
EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]
