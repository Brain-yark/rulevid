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

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend --no-audit

# Copy frontend source code
COPY frontend ./frontend

WORKDIR /app/frontend

# Build args for frontend environment variables during Vite build
ARG VITE_API_URL
ARG VITE_AGORA_APP_ID
ARG VITE_AGORA_CHAT_APP_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AGORA_APP_ID=$VITE_AGORA_APP_ID
ENV VITE_AGORA_CHAT_APP_KEY=$VITE_AGORA_CHAT_APP_KEY

RUN npm run build

# ─── Stage 2: Production Runtime with Nginx ──────────────────────────────────
FROM nginx:alpine

# Copy built SPA bundle to Nginx document root
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# SPA fallback routing config
COPY frontend/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
