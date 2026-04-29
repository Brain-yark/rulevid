# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy shared types first (needed for compilation)
COPY shared ./shared

# Install backend dependencies
WORKDIR /workspace/backend
COPY backend/package*.json ./
RUN npm install

# Copy backend source and configs
COPY backend/src ./src
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/tsconfig.build.json ./tsconfig.build.json

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 2: Production Runtime ─────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy only what we need to run
COPY --from=builder /workspace/backend/node_modules ./node_modules
COPY --from=builder /workspace/backend/package*.json ./
COPY --from=builder /workspace/backend/dist ./dist
COPY --from=builder /workspace/backend/prisma ./prisma

EXPOSE 3001

# Run migrations then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
