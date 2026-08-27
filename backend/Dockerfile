# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Configure npm timeouts & retries for network resilience
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000

# Copy root workspace and shared modules
COPY package*.json ./
COPY shared ./shared

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --no-audit

# Copy backend sources and config
COPY backend/src ./backend/src
COPY backend/prisma ./backend/prisma
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/tsconfig.build.json ./backend/tsconfig.build.json

WORKDIR /app/backend

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 2: Production Runtime ─────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy runtime assets
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Run migrations and start compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/backend/src/index.js"]
