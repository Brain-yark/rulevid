# ─── Stage 1: Build ──────────────────────────────────────────────────────────

FROM node:22-bookworm AS builder

WORKDIR /app

# Configure npm network resilience
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000

# Root dependencies
COPY package*.json ./
COPY shared ./shared

RUN npm install --ignore-scripts --no-audit

# Backend dependencies
COPY backend/package*.json ./backend/

RUN npm install --prefix backend --ignore-scripts --no-audit

# Backend source
COPY backend ./backend

WORKDIR /app/backend

# Only used during Prisma generation
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/svsm_ci"

# Generate Prisma Client
RUN npx prisma generate

# Compile TypeScript + resolve aliases
RUN npm run build


# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────

FROM node:22-bookworm AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# IMPORTANT:
# tsconfig outputs to /app/backend/dist because the build runs
# from /app/backend.
#
# Copy that output into /app/dist in the runtime image.
COPY --from=builder /app/backend/dist ./dist

# Prisma files
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts

# Backend package metadata
COPY --from=builder /app/backend/package*.json ./backend/

# Put backend dependencies where Node can find them
COPY --from=builder /app/backend/node_modules ./node_modules

EXPOSE 3001

# tsc-alias has already converted @shared/* imports.
CMD ["sh", "-c", "npx prisma migrate deploy --config backend/prisma.config.ts && node dist/backend/src/index.js"]