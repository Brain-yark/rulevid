# 🗺️ SVSM Platform — Product & Technical Roadmap

> **Current Phase:** Phase 1 (MVP Baseline Complete)  
> **Target:** Enterprise-Grade Production Video Streaming & Billing Automation

---

## 📌 Roadmap Overview

```
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│        PHASE 1          │ ───► │        PHASE 2          │ ───► │        PHASE 3          │ ───► │        PHASE 4          │
│   MVP Core Baseline     │      │   Billing Automation    │      │  Security & Monitoring  │      │   Enterprise Scale      │
│     (COMPLETED)         │      │     (NEXT UP)           │      │   (PRODUCTION READY)    │      │    (FUTURE EXP)         │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

---

## ✅ Phase 1: MVP Core Baseline (Completed)

Focus: Deliver core live streaming capabilities, authentication, wallet interface, and responsive frontend UI.

- [x] **React 19 SPA Architecture**: Vite 8 + TypeScript SPA with custom glassmorphic design system.
- [x] **Express 5 API Server**: High-performance REST layer with JWT authentication guards (`/api/v1/auth`, `/sessions`, `/billing`).
- [x] **Agora RTC WebRTC Integration**: Low-latency video channel generation, dynamic RTC tokens, and client track publishing.
- [x] **Interactive Dashboard UI**:
  - Modal-based session creation replacing legacy browser prompts.
  - One-click copyable join links with visual toast feedback.
  - Active navigation state tracking and responsive layout.
- [x] **Pre-paid Credit UI**: Wallet overview, tier rates display ($0.003 / $0.004 per min), and preset top-up modal ($10, $25, $50, $100, $250).
- [x] **In-Room Chat**: Text broadcast chat panel inside live streaming rooms.

---

## 🚧 Phase 2: Billing & Metering Automation (Next Sprint)

Focus: Automate Stripe payment webhook processing, Lago metering provisioning, and immediate transaction ledger recording.

### 2.1 Automated Stripe Webhooks
- [ ] Implement `POST /api/v1/billing/webhook` using raw request body parsing.
- [ ] Handle `checkout.session.completed` events to automatically execute top-up transactions in SVSM DB and top up Lago wallets without manual intervention.
- [ ] Implement webhook signature verification with `STRIPE_WEBHOOK_SECRET`.

### 2.2 Lago Customer & Wallet Lifecycle
- [ ] Trigger Lago `Customer` creation inside `authController.register` upon new user registration.
- [ ] Trigger Lago `Wallet` creation and map `lago_wallet_id` to `User` schema.
- [ ] Implement automated low-balance email alerts when credit balance drops below $10.00.

### 2.3 Real-Time WebRTC Event Ingestion
- [ ] Migrate from daily cron job (`0 2 * * *`) to **Agora Channel Webhooks** (`channel_destroy`, `user_leave`).
- [ ] Instantly capture stream end events and emit Lago usage events (`minutes_used`) immediately upon session termination.
- [ ] Fix `balanceAfter` ledger calculation in SVSM `Transaction` records.

---

## 🔒 Phase 3: Security Hardening & Observability

Focus: Prepare infrastructure for production deployment, threat mitigation, and telemetry monitoring.

### 3.1 API Security & Rate Limiting
- [ ] Replace wildcard `cors()` configuration with strict origin whitelist (`FRONTEND_URL`).
- [ ] Add `express-rate-limit` middleware on `/api/v1/auth/login` (max 10 attempts per 15 minutes) and `/api/v1/sessions` (max 30 requests per minute).
- [ ] Implement JWT token blacklist/revocation strategy for instant user logout.

### 3.2 Error Handling & Logging
- [ ] Implement global Express error handler middleware (`(err, req, res, next)`) to sanitize error stack traces.
- [ ] Integrate **Pino** structured JSON logging for request tracing and audit logs.
- [ ] Add **Sentry / OpenTelemetry** SDK to frontend and backend for real-time error tracking and performance profiling.

### 3.3 Production Docker Optimization
- [ ] Upgrade Docker container from development dev server (`ts-node-dev`) to compiled production build (`node dist/index.js`).
- [ ] Implement non-root user execution in Dockerfiles for security compliance.

---

## 🚀 Phase 4: Enterprise Scale & Feature Expansion

Focus: Advanced facilitator tooling, multi-tenancy, recording storage, and analytics.

### 4.1 Cloud Session Recording
- [ ] Integrate Agora Cloud Recording REST API to capture live streams.
- [ ] Automatically upload MP4 recordings to AWS S3 / Cloudflare R2 bucket.
- [ ] Store `recordingUrl` on `Session` model for post-event playback.

### 4.2 Granular Facilitator Controls
- [ ] Host controls: Mute individual participants, disable video feeds, or remove users from room.
- [ ] Screen sharing toggle permissions and host-only broadcast mode.
- [ ] Password-protected private session channels.

### 4.3 Multi-Tenant White-Labeling
- [ ] Custom branding (logo upload, theme accent color selection per facilitator).
- [ ] Custom domain mapping (`stream.facilitatorcompany.com`).
- [ ] Detailed analytics dashboard: Peak concurrent viewers, bandwidth metrics, and spending breakdowns.
