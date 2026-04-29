# SVSM Platform — Full System Documentation

> **Version:** 1.0 (Snapshot: April 2026)  
> **Stack:** React 19 + TypeScript (Frontend) · Node.js / Express 5 + TypeScript (Backend) · PostgreSQL 15 · Prisma ORM · Agora RTC · Stripe · Lago (Metering) · Docker / Nginx  
> **Status:** Core MVP implemented. Several production-critical features are scaffolded or missing.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Infrastructure & Deployment](#5-infrastructure--deployment)
6. [Database Schema (Data Model)](#6-database-schema-data-model)
7. [Shared Types Contract](#7-shared-types-contract)
8. [Backend — Deep Dive](#8-backend--deep-dive)
   - [Entry Point](#81-entry-point-srcindexts)
   - [Database Client](#82-database-client-srcdbts)
   - [Auth Module](#83-auth-module)
   - [Session Module](#84-session-module)
   - [Billing Module](#85-billing-module)
   - [Middleware](#86-middleware)
   - [Services](#87-services)
   - [Background Jobs](#88-background-jobs)
9. [Frontend — Deep Dive](#9-frontend--deep-dive)
   - [App Root & Router](#91-app-root--router-apptsx)
   - [Layout Shell](#92-layout-shell-componentslayouttsx)
   - [Login Page](#93-login-page-pagesloginpagetsx)
   - [Dashboard Page](#94-dashboard-page-pagesdashboardtsx)
   - [Room Page (Live Video)](#95-room-page-pagesroomtsx)
   - [Wallet Page](#96-wallet-page-pageswallettsx)
10. [Complete API Reference](#10-complete-api-reference)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [✅ Implemented Features](#12--implemented-features)
13. [❌ Unimplemented Features (Required for Production)](#13--unimplemented-features-required-for-production)
14. [Security Assessment](#14-security-assessment)
15. [Known Bugs & Critical Issues](#15-known-bugs--critical-issues)
16. [Recommended Implementation Roadmap](#16-recommended-implementation-roadmap)

---

## 1. Project Overview

**SVSM** (**S**treaming **V**ideo **S**ession **M**anager) is a white-label, B2B SaaS platform that enables businesses ("Facilitators") to create, manage, and monetize live video streaming sessions. The platform is built on a **pre-paid credit model**: facilitators must maintain a wallet balance to run sessions, and usage is metered per-minute and deducted automatically via an integrated billing engine.

### Core Value Proposition

| Feature | Description |
|---|---|
| **Live Video** | Powered by Agora RTC — low-latency, globally distributed WebRTC sessions |
| **Pre-paid Wallet** | Facilitators top up via Stripe; credits are consumed per minute of active session |
| **Usage Metering** | Lago open-source metering engine tracks and bills per-minute consumption |
| **Multi-tier Pricing** | `standard` ($0.003/min) and `premium` ($0.004/min) pricing tiers |
| **In-Session Chat** | Local chat panel within live rooms |
| **Participant Management** | View remote video feeds and participant list |

---

## 2. Repository Structure

```
svsm/
├── backend/                    # Node.js / Express API Server
│   ├── src/
│   │   ├── index.ts            # App entry point + cron bootstrap
│   │   ├── db.ts               # Prisma client singleton (pg adapter)
│   │   ├── controllers/
│   │   │   ├── authController.ts      # register / login / getMe
│   │   │   └── sessionController.ts   # CRUD + join/end session logic
│   │   ├── routes/
│   │   │   ├── authRoute.ts           # /api/v1/auth/*
│   │   │   ├── sessionRoute.ts        # /api/v1/sessions/*
│   │   │   └── billingRoute.ts        # /api/v1/billing/*
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts      # JWT Bearer token guard
│   │   │   └── balanceCheck.ts        # $5 minimum balance guard
│   │   ├── services/
│   │   │   ├── agoraTokenService.ts   # RTC token generation (agora-access-token)
│   │   │   ├── billingService.ts      # Lago wallet API wrapper
│   │   │   └── stripeService.ts       # Stripe Checkout session creation
│   │   └── jobs/
│   │       └── usageSync.ts           # Daily cron: sync ended sessions → Lago → DB
│   ├── prisma/
│   │   └── schema.prisma              # PostgreSQL schema (4 models)
│   ├── Dockerfile                     # Multi-stage Node 20 Alpine image
│   └── package.json
│
├── frontend/                   # React 19 + Vite SPA
│   ├── src/
│   │   ├── main.tsx            # React DOM entry
│   │   ├── App.tsx             # Root state machine (page router)
│   │   ├── components/
│   │   │   └── Layout.tsx      # Sticky nav + main content shell
│   │   └── pages/
│   │       ├── LoginPage.tsx   # Login + Register form
│   │       ├── Dashboard.tsx   # Session list + stats
│   │       ├── Room.tsx        # Live Agora video room
│   │       └── Wallet.tsx      # Balance display + Stripe top-up
│   ├── index.html
│   ├── Dockerfile              # Multi-stage Node 20 Alpine image
│   └── package.json
│
├── shared/
│   └── types.ts                # TypeScript interfaces shared across backend
│
├── infra/
│   └── nginx.conf              # Reverse proxy: frontend / api / lago
│
├── docker-compose.yml          # Full stack orchestration (7 services)
├── .env.example                # Environment variable template
└── README.md.txt               # Setup notes
```

---

## 3. Technology Stack

### Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | Server runtime |
| Framework | Express | ^5.2.1 | HTTP server |
| Language | TypeScript | ^6.0.3 | Type safety |
| ORM | Prisma | ^7.7.0 | Database access |
| DB Driver | `pg` + `@prisma/adapter-pg` | ^8.20 | PostgreSQL connection pool |
| Authentication | `jsonwebtoken` | ^9.0.3 | JWT signing/verification |
| Password Hashing | `bcryptjs` | ^3.0.3 | Secure password storage |
| Video Tokens | `agora-access-token` | ^2.0.4 | Agora RTC token generation |
| Payments | `stripe` | ^22.0.2 | Checkout session creation |
| Metering | `axios` (Lago REST) | ^1.15.0 | Lago API client |
| Scheduler | `node-cron` | ^4.2.1 | Daily usage sync cron |
| Dev Tool | `ts-node-dev` | ^2.0.0 | HMR dev server |

### Frontend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | ^19.2.4 | UI rendering |
| Language | TypeScript | ~6.0.2 | Type safety |
| Build Tool | Vite | ^8.0.4 | Bundler + dev server |
| Video SDK | `agora-rtc-react` | ^2.5.1 | React hooks for Agora RTC |
| Video Engine | `agora-rtc-sdk-ng` | ^4.24.3 | Agora WebRTC transport |
| Icons | `lucide-react` | ^1.8.0 | Icon library |
| Animation | `framer-motion` | ^12.38.0 | (installed, not yet used) |
| Styling | Vanilla CSS-in-JS | — | Inline `<style>` per component |

### Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL 15 Alpine | Primary data store (SVSM) |
| Metering DB | PostgreSQL 15 Alpine | Lago's dedicated database |
| Cache/Queue | Redis 7 Alpine | Lago background job queue |
| Proxy | Nginx Alpine | Unified entry point on port 8080 |
| Billing Engine | Lago (self-hosted) | Open-source usage metering |
| Containerization | Docker + Docker Compose | Local orchestration |

---

## 4. System Architecture

```
                          ┌──────────────────────┐
                          │   Browser / Client   │
                          └──────────┬───────────┘
                                     │ :8080
                          ┌──────────▼───────────┐
                          │    Nginx Proxy        │
                          │  (infra/nginx.conf)   │
                          └──┬───────────┬────────┘
                       /     │    /api/  │    /lago/
            ┌──────────▼──┐  │  ┌───────▼──────┐  ┌──────────────┐
            │   Frontend   │  │  │   Backend    │  │  Lago API    │
            │  React SPA   │  │  │  Express 5   │  │  Rails App   │
            │   :80 (vite) │  │  │    :3001     │  │   :3000      │
            └─────────────┘  │  └──────┬───────┘  └──────┬───────┘
                             │         │                  │
                    ┌────────┘  ┌──────▼───────┐  ┌──────▼───────┐
                               │  PostgreSQL  │  │  PostgreSQL  │
                               │  SVSM DB     │  │  Lago DB     │
                               │  :5432       │  │  :5432       │
                               └─────────────┘  └──────┬───────┘
                                                        │
                                                 ┌──────▼───────┐
                                                 │  Redis       │
                                                 │  Lago Queue  │
                                                 └─────────────┘

     External Services:
     ┌─────────────────┐    ┌─────────────────┐
     │  Agora RTC      │    │  Stripe         │
     │  (Cloud Media)  │    │  (Payments)     │
     └─────────────────┘    └─────────────────┘
```

### Data / Control Flow for a Live Session

```
1. Facilitator logs in  →  Backend issues JWT (7-day)
2. Creates session      →  Backend: generates channelName, Agora token, saves to DB
3. Joins room           →  Frontend calls /sessions/:id/join → gets Agora token
4. Agora SDK connects   →  Client ↔ Agora Cloud RTC (direct WebRTC, not via backend)
5. Remote users join    →  Also call /join to get their own Agora tokens
6. Session ends         →  POST /sessions/:id/end → DB: status=ended, totalMinutes calculated
7. Usage sync (2AM UTC) →  CronJob: finds ended sessions → posts events to Lago → creates
                            UsageRecord + Transaction in SVSM DB
```

---

## 5. Infrastructure & Deployment

### Docker Compose — 7 Services

```yaml
proxy        → Nginx:alpine on :8080  (routes to frontend, backend, lago)
backend      → Node 20 Alpine         (built from ./backend/Dockerfile)
frontend     → Node 20 Alpine         (Vite dev server on :80)
db           → PostgreSQL 15 Alpine   (:5433 on host, :5432 internal)
lago-api     → Lago Rails app         (built from ../lago-api, not in this repo)
lago-worker  → Lago Sidekiq worker    (same image, different command)
lago-db      → PostgreSQL 15 Alpine   (:5434 on host, :5432 internal)
lago-redis   → Redis 7 Alpine         (internal only)
```

> ⚠️ **Note:** `lago-api` and `lago-worker` reference `../lago-api` — a sibling directory **outside** this repo. That directory must be cloned separately for the full stack to function.

### Nginx Routing Rules

| Path | Proxies To | Notes |
|---|---|---|
| `/` | `http://frontend:80/` | All frontend traffic; WebSocket upgrade headers set |
| `/api/` | `http://backend:3001/api/` | All API calls; WebSocket-capable |
| `/lago/` | `http://lago-api:3000/` | Lago admin/API forwarding |

### Backend Dockerfile (Multi-Stage)

```
Stage 1 (builder): node:20-alpine
  - npm install
  - npx prisma generate
  - npm run build (gracefully skipped if no build script)

Stage 2 (runtime): node:20-alpine
  - Copies: node_modules, package.json, prisma/, src/
  - EXPOSE 3001
  - CMD: npm run dev  (ts-node-dev — NOT a production build)
```

> ⚠️ **The Docker image runs the dev server (`ts-node-dev`), not a compiled production binary.**

---

## 6. Database Schema (Data Model)

Provider: **PostgreSQL** via Prisma ORM with `@prisma/adapter-pg` (connection pool adapter).

### Entity Relationship Diagram

```
User ──────┬──< Session (facilitator owns sessions)
           ├──< Transaction (payment events)
           └──< UsageRecord (billing records)

Session ───└──< UsageRecord (one usage record per ended session)
```

### Model: `User`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String` | PK, UUID | Auto-generated |
| `email` | `String` | UNIQUE | Login identifier |
| `passwordHash` | `String` | — | bcrypt, salt=10 |
| `companyName` | `String?` | Optional | B2B company name |
| `walletId` | `String?` | Optional | Reference to Lago wallet ID |
| `stripeCustomerId` | `String?` | Optional | Stripe Customer ID |
| `pricingTier` | `String` | Default: `"standard"` | `"standard"` ($0.003/min) or `"premium"` ($0.004/min) |
| `status` | `String` | Default: `"active"` | `"active"`, `"suspended"`, `"pending"` |
| `sessions` | `Session[]` | Relation | Sessions created by this user |
| `transactions` | `Transaction[]` | Relation | Payment history |
| `usageRecords` | `UsageRecord[]` | Relation | Billing records |

### Model: `Session`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String` | PK, UUID | Auto-generated |
| `title` | `String` | Required | Human-readable session name |
| `channelName` | `String` | UNIQUE | Agora channel: `f_{userId}_{rand}_{ts}` |
| `status` | `String` | Default: `"scheduled"` | `"scheduled"`, `"active"`, `"ended"` |
| `startedAt` | `DateTime?` | Nullable | Set when first user joins |
| `endedAt` | `DateTime?` | Nullable | Set when `endSession` called |
| `participantCount` | `Int` | Default: `0` | **Not updated dynamically** |
| `totalMinutes` | `Int` | Default: `0` | Calculated on session end |
| `recordingUrl` | `String?` | Nullable | **Field exists, never populated** |
| `facilitatorId` | `String` | FK → User | Session owner |
| `usageRecords` | `UsageRecord[]` | Relation | — |

### Model: `Transaction`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String` | PK, UUID | Auto-generated |
| `type` | `String` | — | `"topup"` or `"deduction"` |
| `amount` | `Float` | — | Positive=topup, negative=deduction |
| `currency` | `String` | Default: `"USD"` | — |
| `balanceAfter` | `Float` | — | **Always stored as `0`** — bug |
| `description` | `String?` | Nullable | Human-readable note |
| `lagoTransactionId` | `String?` | Nullable | **Never populated** |
| `status` | `String` | Default: `"completed"` | `"pending"`, `"completed"`, `"failed"` |
| `userId` | `String` | FK → User | — |

### Model: `UsageRecord`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String` | PK, UUID | Auto-generated |
| `minutesUsed` | `Int` | — | Total session minutes |
| `costToFacilitator` | `Float` | — | `minutes × ratePerMinute` |
| `ratePerMinute` | `Float` | — | `0.003` or `0.004` |
| `syncedAt` | `DateTime?` | Nullable | When Lago was notified |
| `userId` | `String` | FK → User | — |
| `sessionId` | `String` | FK → Session | — |

---

## 7. Shared Types Contract

File: `shared/types.ts` — used by the backend to type API responses.

```typescript
interface User {
  id: string;
  email: string;
  companyName?: string;
  pricingTier: string;
  status: string;
  walletId?: string;
}

interface Session {
  id: string;
  title: string;
  channelName: string;
  status: 'active' | 'scheduled' | 'ended';
  startedAt?: Date;
  endedAt?: Date;
  participantCount: number;
  totalMinutes: number;
  recordingUrl?: string;
  facilitatorId: string;
}

interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: number;
  expiresAt: number;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface Transaction {
  id: string;
  type: 'topup' | 'deduction';
  amount: number;
  currency: string;
  balanceAfter: number;
  description?: string;
  status: string;
  createdAt: string;
}
```

> ⚠️ The `shared/` types are only imported by the backend. The **frontend** has its own local inline interfaces that duplicate these definitions and are not centrally imported.

---

## 8. Backend — Deep Dive

### 8.1 Entry Point: `src/index.ts`

```typescript
const app = express();
app.use(cors());           // ⚠️ Open CORS — allows ALL origins
app.use(express.json());

app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/billing',  billingRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: ... }));

app.listen(PORT, () => {
  usageSyncJob.start();   // Registers daily cron on startup
});
```

**Key observations:**
- Port defaults to `3001` (from `process.env.PORT`)
- `cors()` is called **without options** — accepts all cross-origin requests
- No global error handler registered
- No request logging (morgan/pino absent)
- `usageSyncJob.start()` hooks into `node-cron` for the `0 2 * * *` schedule

---

### 8.2 Database Client: `src/db.ts`

```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

Uses **Prisma's PostgreSQL adapter** (`@prisma/adapter-pg`) for a manual `pg.Pool`, allowing connection pooling configuration. The `prisma` singleton is imported across all controllers and jobs.

---

### 8.3 Auth Module

#### Route: `src/routes/authRoute.ts`

```
POST /api/v1/auth/register  →  authController.register
POST /api/v1/auth/login     →  authController.login
GET  /api/v1/auth/me        →  authController.getMe
```

> ⚠️ `/me` does NOT use the `requireAuth` middleware — it re-implements JWT verification inline.

#### Controller: `src/controllers/authController.ts`

**`register(req, res)`**
1. Validates `email` and `password` (returns 400 if missing)
2. Checks for duplicate email via `prisma.user.findUnique`
3. Hashes password with `bcrypt.hash(password, 10)` (10 salt rounds)
4. Creates `User` record — **does NOT create Lago wallet or Stripe Customer at this point**
5. Signs a JWT: `jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })`
6. Returns `AuthResponse` (user object + token)

**`login(req, res)`**
1. Finds user by email
2. Compares password with `bcrypt.compare`
3. Signs a fresh 7-day JWT
4. Returns `AuthResponse`

**`getMe(req, res)`**
- Manually extracts and verifies Bearer token from `Authorization` header
- Fetches user from DB and returns same `AuthResponse` shape
- **Duplicates logic from `authMiddleware.ts`** — should use middleware

---

### 8.4 Session Module

#### Route: `src/routes/sessionRoute.ts`

```
POST /api/v1/sessions           →  requireAuth → checkBalance → createSession
GET  /api/v1/sessions           →  requireAuth → getSessions
POST /api/v1/sessions/:id/join  →  requireAuth → joinSession
POST /api/v1/sessions/:id/end   →  requireAuth → endSession
```

**Middleware chain for session creation:**
`requireAuth` verifies JWT → `checkBalance` enforces $5 minimum → `createSession` runs

#### Controller: `src/controllers/sessionController.ts`

**`createSession(req, res)`**
1. Extracts `userId` from JWT payload (injected by `requireAuth` as `req.user`)
2. Validates `title` field
3. Generates a unique channel name: `` `f_${userId}_${randomStr}_${Date.now()}` ``
4. Calls `generateAgoraToken(channelName, userId, 'publisher')` for the creator
5. Persists `Session` to DB with `status: 'scheduled'`
6. Returns: `{ session, agoraToken, expiresAt, uid }`

**`getSessions(req, res)`**
- Returns all sessions for the authenticated facilitator, ordered by `createdAt DESC`
- **No pagination** — returns all records at once

**`joinSession(req, res)`**
1. Finds session by `id`
2. Generates a new Agora token for the joining user (also as `'publisher'`)
3. If session status is `'scheduled'`, transitions to `'active'` and sets `startedAt`
4. Returns `{ session, agoraToken, expiresAt, uid }`
- **Anyone with a valid JWT can join any session** — no facilitator-only gate

**`endSession(req, res)`**
1. Fetches session
2. Verifies `session.facilitatorId === userId` — only facilitator can end
3. Calculates `totalMinutes = ceil((endedAt - startedAt) / 60000)`
4. Updates session: `status='ended'`, `endedAt`, `totalMinutes`
- **Does NOT immediately trigger billing deduction** — deferred to nightly cron

---

### 8.5 Billing Module

#### Route: `src/routes/billingRoute.ts`

All routes under this router apply `requireAuth` via `router.use(requireAuth)`.

```
GET  /api/v1/billing/balance  →  billingService.getWalletBalance(userId)
POST /api/v1/billing/topup    →  stripeService.createTopupSession(userId, amount, ...)
```

**`GET /balance`**
- Calls `billingService.getWalletBalance(userId)`
- If `LAGO_API_KEY` is not set → returns **mock balance of $124.50**
- If Lago is configured → queries `GET /api/v1/wallets/{facilitatorId}` on Lago

**`POST /topup`**
- Validates `amount > 0`
- Calls `stripeService.createTopupSession(...)` to create a Stripe Checkout session
- Returns `{ checkout_url, message }` — frontend redirects to Stripe
- After payment, Stripe redirects to `FRONTEND_URL/wallet?success=true` or `?canceled=true`
- **No Stripe webhook handler exists** — balance is NOT updated in DB after payment

---

### 8.6 Middleware

#### `src/middleware/authMiddleware.ts` — `requireAuth`

```typescript
export const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, JWT_SECRET);
  (req as any).user = decoded;  // { userId: string, iat, exp }
  next();
};
```

- Returns `401` for missing or invalid tokens
- Attaches decoded JWT payload as `req.user`

#### `src/middleware/balanceCheck.ts` — `checkBalance`

```typescript
export const checkBalance = async (req, res, next) => {
  const wallet = await billingService.getWalletBalance(userId);
  if (wallet.balance < 5) {
    return res.status(402).json({ error: 'Insufficient balance', ... });
  }
  (req as any).walletBalance = wallet.balance;
  next();
};
```

- Enforces **$5.00 minimum** before allowing session creation
- On **Lago API error** → `next()` is called anyway (fail-open logic — security risk)

---

### 8.7 Services

#### `src/services/agoraTokenService.ts`

```typescript
export const generateAgoraToken = (channelName, userId, role) => {
  const uid = 0;  // Dynamic UID assignment by Agora server
  const expireTime = 3600; // 1 hour
  const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channelName, uid, roleNum, ts);
  return { token, expiresAt, channelName, uid };
};
```

- Uses `agora-access-token` SDK `RtcTokenBuilder`
- **All users get `uid = 0`** — Agora assigns UIDs dynamically at connection time
- Token expires in **1 hour** — no refresh mechanism implemented
- Both facilitators and participants are assigned `PUBLISHER` role — no `SUBSCRIBER`-only role for audience

#### `src/services/billingService.ts`

```typescript
class BillingService {
  async getWalletBalance(facilitatorId: string) {
    if (!LAGO_API_KEY) return { balance: 124.50, currency: 'USD' };  // MOCK
    // GET /api/v1/wallets/{facilitatorId}
    return { balance: cents / 100, currency };
  }

  async deductMinutes(facilitatorId: string, minutesUsed: number) {
    if (!LAGO_API_KEY) return { status: 'mock_success' };
    // POST /api/v1/events  { code: 'agora_minutes', amount: minutesUsed }
  }
}
```

- **Dual mode:** Falls back to mock when `LAGO_API_KEY` is absent
- Uses `facilitatorId` (the SVSM user UUID) as `external_customer_id` in Lago — Lago customer must be pre-created with this identifier
- The Lago event code `'agora_minutes'` must be configured as a billable metric in Lago

#### `src/services/stripeService.ts`

```typescript
class StripeService {
  async createTopupSession(userId, amount, successUrl, cancelUrl) {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', unit_amount: amount * 100, ... }, quantity: 1 }],
      mode: 'payment',
      success_url,
      cancel_url,
      metadata: { userId, type: 'wallet_topup', amount: amount.toString() }
    });
    return session; // caller uses session.url
  }
}
```

- Creates a one-time Stripe Checkout session
- Metadata includes `userId` and `type` for future webhook processing
- **The `handleStripeWebhook` method is noted in a comment but NOT implemented**

---

### 8.8 Background Jobs

#### `src/jobs/usageSync.ts`

**Schedule:** `0 2 * * *` — runs every day at **2:00 AM UTC**

**`syncUsage()` — the sync pipeline:**

```
1. Query: find Session WHERE status='ended' AND totalMinutes > 0 AND UsageRecords = EMPTY
2. For each session:
   a. Determine rate: premium → $0.004/min, standard → $0.003/min
   b. Calculate cost: totalMinutes × rate
   c. POST usage event to Lago (deductMinutes)
   d. Create UsageRecord in DB
   e. Create Transaction record in DB (type='deduction', balanceAfter=0 ← hardcoded bug)
```

**Critical observations:**
- `balanceAfter` is **hardcoded to `0`** — never fetched from Lago post-deduction
- No retry logic for failed Lago API calls
- Lago deduction and local DB record creation are **not atomic** — partial state possible on error
- The `agoraApiUrl` and Agora credential fields exist in the class but are **never used** — the real-time Agora usage data polling (to get exact minute counts from Agora's own analytics API) is not implemented
- `syncedAt` field is recorded on `UsageRecord` but Lago's `lagoTransactionId` returned from the event API is not captured

---

## 9. Frontend — Deep Dive

### 9.1 App Root & Router: `App.tsx`

The app uses a **custom state-machine router** — no React Router library. Page state is managed with `useState<Page>`.

```typescript
type Page = 'login' | 'dashboard' | 'room' | 'wallet';
```

**State:**
- `currentPage` — active view
- `activeSessionId` — the session ID passed to `<Room>`
- `user` — email-only object from localStorage

**On mount:** `validateToken()` is called — fetches `/api/v1/auth/me` to restore session from `localStorage.auth_token`. If valid → navigates to `'dashboard'`.

**Agora Provider:** `AgoraRTCProvider` wraps all authenticated pages with a shared RTC client (`mode: 'rtc', codec: 'vp8'`).

**Navigation events (props-based):**
- `onJoinRoom(id)` → `activeSessionId = id`, `currentPage = 'room'`
- `onGoToWallet()` → `currentPage = 'wallet'`
- `onBack()` from Wallet → `currentPage = 'dashboard'`
- `onExit()` from Room → `activeSessionId = null`, `currentPage = 'dashboard'`

---

### 9.2 Layout Shell: `components/Layout.tsx`

A sticky glassmorphic navigation bar + main content area.

**Nav items:**
- **SVSM Platform** logo (links nowhere)
- **Dashboard** button → `onNavigate('dashboard')`
- **Wallet** button → `onNavigate('wallet')`
- User email display
- **Logout** button → clears localStorage + resets state

CSS: All styles are inline `<style>` tags within the component. Uses CSS custom properties (`--primary`, `--text-muted`, `--glass-border`, `--accent`, `--transition-fast`) defined in `index.css` / `App.css`.

---

### 9.3 Login Page: `pages/LoginPage.tsx`

A split-screen layout: hero branding panel (left) + auth form (right).

**Modes:** Toggled via `isLogin` state.
- **Login mode:** email + password → `POST /api/v1/auth/login`
- **Register mode:** companyName + email + password → `POST /api/v1/auth/register`

**On success:**
- Stores `auth_token` and `user` JSON in `localStorage`
- Calls `onLogin(email)` prop → App switches to dashboard

**Features:**
- Loading state with button disabled
- Inline error display (red alert box)
- Toggle between login/register with error clear

---

### 9.4 Dashboard Page: `pages/Dashboard.tsx`

The main facilitator control panel.

**Data fetching (on mount):**
- `fetchBalance()` → `GET /api/v1/billing/balance` → sets wallet balance in state
- `fetchSessions()` → `GET /api/v1/sessions` → sets session list

**Stats cards (3 KPI tiles):**
1. Total Sessions — `sessions.length`
2. Total Participants — `sessions.reduce(sum of participantCount)` ← always `0` since `participantCount` is never updated
3. Wallet Balance — clickable, navigates to Wallet page

**Session grid:**
- Cards with status badge, title, date, participant count
- **Active/Scheduled sessions:** "Join Room" button + "End Session" button (active only)
- **Ended sessions:** Disabled "Session Ended" button

**Create Session:**
- `prompt()` dialog (browser native) for title input — **not a proper modal**
- Posts to `POST /api/v1/sessions`
- Refreshes session list on success

**Session search/filter:**
- Search bar UI exists but the `<input>` is **not wired to any filter logic**
- Filter button shows an `alert('Filter options coming soon')`

---

### 9.5 Room Page: `pages/Room.tsx`

The live video conference room.

**Two-component architecture:**
1. `Room` — Fetches the Agora token via `POST /sessions/:id/join`, then renders `ActiveRoom`
2. `ActiveRoom` — The actual live room UI with all video and controls

**Agora integration (hooks from `agora-rtc-react`):**
```typescript
const { localMicrophoneTrack } = useLocalMicrophoneTrack();
const { localCameraTrack }     = useLocalCameraTrack();
useJoin({ appid: APP_ID, channel, token, uid });
usePublish([localMicrophoneTrack, localCameraTrack]);
const remoteUsers = useRemoteUsers();
```

**Layout:**
- Main video area (left) + Side panel (right, always visible)
- Local camera feed displayed in main "host" tile with LIVE badge
- Remote users rendered in scrollable bottom row (horizontal strip)
- Channel name watermark in top-right of main video

**Controls bar (pill-shaped):**

| Button | Status | Notes |
|---|---|---|
| Mic toggle | ✅ Working | `localMicrophoneTrack.setEnabled(toggle)` |
| Camera toggle | ✅ Working | `localCameraTrack.setEnabled(toggle)` |
| Raise hand | ❌ Stub | `alert('Hand raised')` |
| Screen share | ❌ Stub | `alert('Screen share coming soon')` |
| Settings | ❌ Stub | `alert('Settings coming soon')` |
| End call (red) | ✅ Working | Calls `/sessions/:id/end` then `onExit()` |

**Side panel (always open):**
- **Chat tab:** Local-only in-memory messages (array state). No WebSocket/Lago/Socket.io integration.
- **Participants tab:** Hardcoded list of `[1-8]` mock users labeled "User 1"..."User 8" — not real participant data

**App ID hardcoded:**
```typescript
const APP_ID = "81aeffb4262b45a8ad4c91286f55da3a";
```
This is a real Agora App ID embedded directly in source code — a **security/ops risk**.

---

### 9.6 Wallet Page: `pages/Wallet.tsx`

**Balance display:**
- Fetches live balance from `/api/v1/billing/balance` on mount
- Large dollar amount displayed
- Approximate minutes remaining is **hardcoded** as `"Approx. 41,500 minutes remaining"` — not calculated from actual balance

**Stripe redirect detection:**
- Checks `?success=true` or `?canceled=true` query params on mount
- Shows a browser `alert()` popup — not an in-page notification

**Top-up modal:**
- Preset amounts: $25, $50, $100, $250
- On confirm: calls `/api/v1/billing/topup` → redirects entire window to `checkout_url`

**Transaction history:**
- **Hardcoded mock data** — two static transactions shown regardless of real DB state
- No real API call to fetch transactions

**"Manage Payment Methods" button:**
- Shows `alert('Redirecting to Stripe Customer Portal...')` — **Stripe Customer Portal not implemented**

---

## 10. Complete API Reference

Base URL: `http://localhost:3001` (dev) | `http://localhost:8080/api` (via Nginx proxy)

### Authentication Routes

#### `POST /api/v1/auth/register`
Register a new facilitator account.

**Request:**
```json
{ "email": "user@example.com", "password": "secret123", "companyName": "Acme Corp" }
```
**Response `201`:**
```json
{ "user": { "id": "uuid", "email": "...", "pricingTier": "standard", "status": "active" }, "token": "eyJ..." }
```
**Errors:** `400` duplicate email | `400` missing fields | `500` server error

---

#### `POST /api/v1/auth/login`
Authenticate and receive a JWT.

**Request:** `{ "email": "...", "password": "..." }`  
**Response `200`:** Same as register

---

#### `GET /api/v1/auth/me`
Fetch current user from token.

**Headers:** `Authorization: Bearer <token>`  
**Response `200`:** Same as register

---

### Session Routes

All require `Authorization: Bearer <token>`

#### `POST /api/v1/sessions`
Create a new session.

**Additional guard:** `checkBalance` — requires wallet ≥ $5.00

**Request:** `{ "title": "My Webinar" }`  
**Response `201`:**
```json
{
  "session": { "id": "...", "title": "...", "channelName": "f_...", "status": "scheduled", ... },
  "agoraToken": "007eJxT...",
  "expiresAt": 1745000000,
  "uid": 0
}
```
**Errors:** `400` missing title | `402` insufficient balance

---

#### `GET /api/v1/sessions`
List all sessions for the authenticated facilitator.

**Response `200`:** Array of `Session` objects, newest first

---

#### `POST /api/v1/sessions/:id/join`
Join an existing session and receive an Agora token.

**Response `200`:**
```json
{
  "session": { ...session object... },
  "agoraToken": "007eJx...",
  "expiresAt": 1745000000,
  "uid": 0
}
```
**Side effect:** If `status === 'scheduled'`, transitions to `'active'` and sets `startedAt`

---

#### `POST /api/v1/sessions/:id/end`
End an active session. Only the facilitator can call this.

**Response `200`:** Updated session object with `status='ended'`, `endedAt`, `totalMinutes`

**Errors:** `403` not facilitator | `400` already ended | `404` not found

---

### Billing Routes

All require `Authorization: Bearer <token>`

#### `GET /api/v1/billing/balance`
Fetch current wallet balance.

**Response `200`:** `{ "balance": 124.50, "currency": "USD" }`

---

#### `POST /api/v1/billing/topup`
Create a Stripe Checkout session for wallet top-up.

**Request:** `{ "amount": 100 }`  
**Response `200`:**
```json
{ "checkout_url": "https://checkout.stripe.com/pay/cs_...", "message": "Redirecting to secure Stripe Checkout" }
```

---

### Health Check

#### `GET /health`
**Response `200`:** `{ "status": "ok", "time": "2026-04-20T21:00:00.000Z" }`

---

## 11. Environment Variables Reference

| Variable | Where Used | Required | Notes |
|---|---|---|---|
| `PORT` | Backend | No | Defaults to `3001` |
| `DATABASE_URL` | Backend | **YES** | PostgreSQL connection string |
| `JWT_SECRET` | Backend | **YES** | Used for signing/verifying JWTs |
| `AGORA_APP_ID` | Backend | **YES** | Used in token generation |
| `AGORA_APP_CERTIFICATE` | Backend | **YES** | Used in token generation |
| `AGORA_CUSTOMER_ID` | Backend (usageSync) | No | Declared but **never used** |
| `AGORA_API_KEY` | Backend (usageSync) | No | Declared but **never used** |
| `AGORA_API_SECRET` | Backend (usageSync) | No | Declared but **never used** |
| `STRIPE_SECRET_KEY` | Backend | **YES** | Required for stripe checkout |
| `STRIPE_PUBLISHABLE_KEY` | Backend (.env) | No | Declared but **never sent to frontend** |
| `LAGO_API_URL` | Backend | No | Defaults to `https://api.getlago.com` |
| `LAGO_API_KEY` | Backend | No | If absent → **mock mode** |
| `FRONTEND_URL` | Backend | No | For Stripe redirect URLs. Defaults to `http://localhost:5173` |
| `LAGO_RSA_PRIVATE_KEY` | Docker Compose (Lago) | YES (Lago) | Only relevant for full Lago stack |
| `LAGO_SECRET_KEY_BASE` | Docker Compose (Lago) | YES (Lago) | Only relevant for full Lago stack |

---

## 12. ✅ Implemented Features

### Authentication System
- [x] Facilitator **registration** (email + password + companyName)
- [x] Secure **password hashing** with bcrypt (salt=10)
- [x] **JWT-based login** with 7-day token expiry
- [x] **Token persistence** via localStorage
- [x] **Auto session restore** on page refresh (via `/auth/me`)
- [x] **Logout** with full state/storage cleanup

### Session Management (Core CRUD)
- [x] **Create session** with unique Agora channel name generation
- [x] **List sessions** for authenticated facilitator (newest first)
- [x] **Join session** — Agora token generation + status transition `scheduled → active`
- [x] **End session** — facilitator-only, calculates `totalMinutes`, transitions `→ ended`
- [x] Session status lifecycle: `scheduled → active → ended`
- [x] Balance guard middleware enforcing **$5.00 minimum** to create sessions

### Live Video (Agora RTC)
- [x] **Agora RTC token generation** server-side (using `agora-access-token` SDK)
- [x] **Local camera & microphone** capture via `useLocalCameraTrack` / `useLocalMicrophoneTrack`
- [x] **Video publishing** via `usePublish`
- [x] Channel **join** via `useJoin`
- [x] **Remote user video** rendering via `RemoteVideoTrack` + `useRemoteUsers`
- [x] **Mic toggle** (enable/disable local mic track)
- [x] **Camera toggle** (enable/disable local camera track)
- [x] **LIVE badge** indicator on main video tile
- [x] **Exit/End call** button (calls backend + exits room)

### Billing & Payments
- [x] **Stripe Checkout** top-up flow (creates payment session, redirects user)
- [x] Stripe **success/cancel redirect detection** on Wallet page
- [x] **Wallet balance display** (real Lago or mock)
- [x] Top-up amount preset options ($25, $50, $100, $250)

### Usage Metering (Automated)
- [x] **Daily cron job** (`0 2 * * *`) discovers unprocessed ended sessions
- [x] **Usage deduction** posted to Lago (`agora_minutes` event)
- [x] **`UsageRecord`** created per processed session
- [x] **`Transaction` deduction record** created in SVSM DB
- [x] **Pricing tier differentiation** (0.003 standard / 0.004 premium)

### Frontend UX
- [x] **Glassmorphic dark UI** with CSS custom properties
- [x] **Session cards** with status badges and action buttons
- [x] **In-room chat panel** (local memory only)
- [x] **Participant panel** (UI only, not real data)
- [x] **Responsive login form** with mobile layout
- [x] **Sticky navigation** with Dashboard/Wallet links

### Infrastructure
- [x] **Docker Compose** for full-stack local development
- [x] **Nginx reverse proxy** routing frontend, backend, and Lago service
- [x] **Multi-stage Dockerfiles** for both frontend and backend
- [x] **PostgreSQL** data persistence via Docker volume
- [x] **Health check** endpoint (`/health`)

---

## 13. ❌ Unimplemented Features (Required for Production)

### 🔴 CRITICAL — Billing Integrity

#### 1. Stripe Webhook Handler
**What's missing:** After a user pays on Stripe Checkout, no server-side webhook exists to confirm payment and credit the user's Lago wallet.

**Current behavior:** Payment completes on Stripe, user is redirected to `?success=true`, but their Lago balance is **never updated**. The wallet stays at $0.

**Required implementation:**
- `POST /api/v1/billing/webhook` — Stripe webhook endpoint
- Stripe signature verification (`stripe.webhooks.constructEvent`)
- Listen for `checkout.session.completed` event
- Extract `metadata.userId` and `metadata.amount`
- Create/credit Lago wallet via `POST /api/v1/wallets` + `POST /api/v1/wallet_transactions`
- Update `User.stripeCustomerId` and `User.walletId` in SVSM DB
- Create a `Transaction` record of type `topup` with correct `balanceAfter`

---

#### 2. Lago Customer & Wallet Creation on Register
**What's missing:** When a new user registers, no Lago customer or wallet is created.

**Current behavior:** The user exists in SVSM DB but Lago has no record of them. `billingService.getWalletBalance(userId)` returns mock `$124.50` in dev, `$0` (error) in prod.

**Required implementation:**
- After successful `prisma.user.create`, call Lago:
  - `POST /api/v1/customers` to create Lago customer with `external_id = user.id`
  - `POST /api/v1/wallets` to create prepaid wallet for that customer
- Store returned `walletId` in `User.walletId`
- Store Stripe Customer ID via `stripe.customers.create` and save to `User.stripeCustomerId`

---

#### 3. `balanceAfter` Always Zero
**What's missing:** The `Transaction.balanceAfter` field is hardcoded to `0` in `usageSync.ts`.

**Required implementation:**
- After `billingService.deductMinutes`, fetch updated balance from Lago
- Store actual remaining balance in `Transaction.balanceAfter`

---

### 🔴 CRITICAL — Security

#### 4. Open CORS Policy
**What's missing:** `app.use(cors())` with no options allows **any origin** to access the API.

**Required implementation:**
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

#### 5. Agora App ID Hardcoded in Frontend
**What's missing:** `const APP_ID = "81aeffb4262b45a8ad4c91286f55da3a"` is committed to source code.

**Required implementation:**
- Move to `VITE_AGORA_APP_ID` environment variable
- Use `import.meta.env.VITE_AGORA_APP_ID` in `Room.tsx`
- Rotate the exposed App ID on Agora Console

---

#### 6. JWT Token Not Refreshed
**What's missing:** JWT tokens are 7-day fixed tokens with no refresh mechanism.

**Required implementation:**
- Implement refresh token flow (separate long-lived refresh token)
- Or implement token sliding expiry
- Agora tokens expire in **1 hour** — if a session runs longer than 1 hour, the video connection will drop

---

#### 7. `checkBalance` Fails Open on Error
**What's missing:** If Lago API fails, `checkBalance` calls `next()` — allowing session creation even without confirmed balance.

**Required implementation:**
- On Lago API failure, return `503 Service Unavailable` or block session creation

---

### 🟡 HIGH — Feature Completeness

#### 8. Real-Time Participant Count
**What's missing:** `Session.participantCount` is never updated. All sessions show 0 participants.

**Required implementation:**
- Agora provides webhook callbacks (`RTM` or cloud recording events) when users join/leave
- Alternatively: query Agora Console API for channel member count
- Update `participantCount` in DB when users join/leave sessions

---

#### 9. Real Transaction History
**What's missing:** Wallet page shows hardcoded mock transaction data.

**Required implementation:**
- `GET /api/v1/billing/transactions` endpoint
- Query `Transaction` table for current user, return paginated list
- Wire frontend Wallet page to call this endpoint

---

#### 10. Screen Sharing
**What's missing:** Screen share button shows `alert('coming soon')`.

**Required implementation:**
```typescript
const screenTrack = await AgoraRTC.createScreenVideoTrack();
await client.unpublish(localCameraTrack);
await client.publish(screenTrack);
```

---

#### 11. Raise Hand / Audience Roles
**What's missing:** Hand raise is a stub alert. Participant panel shows fake data.

**Required implementation:**
- Agora RTM (Real-Time Messaging) or custom signaling for hand-raise events
- Proper role management (PUBLISHER vs. SUBSCRIBER) — currently all users are PUBLISHER

---

#### 12. Real-Time Chat (WebSocket)
**What's missing:** Chat is local-only. Messages do not reach other participants.

**Required implementation:**
- Backend: WebSocket server (e.g., `ws`, `socket.io`) or Agora RTM integration
- Frontend: Connect to WebSocket on room join, broadcast/receive messages

---

#### 13. Session Recording
**What's missing:** `Session.recordingUrl` column exists but is never populated. Agora Cloud Recording is not configured.

**Required implementation:**
- Enable Agora Cloud Recording via REST API when session starts
- Store recording URL in `Session.recordingUrl` when recording completes

---

#### 14. Accurate Minute Estimation (Wallet Page)
**What's missing:** "Approx. 41,500 minutes remaining" is hardcoded text.

**Required implementation:**
```typescript
const estimatedMinutes = Math.floor(balance / ratePerMinute);
```
The pricing tier must be fetched from the user object to determine the correct rate.

---

#### 15. Stripe Customer Portal Integration
**What's missing:** "Manage Payment Methods" shows an alert stub.

**Required implementation:**
- Backend: `POST /api/v1/billing/portal` — create Stripe Billing Portal session
- Frontend: Redirect to portal URL to manage cards, subscriptions, invoices

---

#### 16. Search & Filter on Dashboard
**What's missing:** Search input is not wired to any filter logic. Filter button is a stub.

**Required implementation:**
- Client-side: filter `sessions` array by title substring on input change
- Server-side: add `?status=active` / `?search=...` query params to `GET /sessions`

---

### 🟡 HIGH — Developer Experience / Reliability

#### 17. Production Build Pipeline
**What's missing:** Both Docker containers run `npm run dev` (Vite dev server + ts-node-dev). These are **not production-grade**.

**Required implementation:**
- Backend: `tsc` compile step + run `node dist/index.js`
- Frontend: `vite build` → serve static files via Nginx directly (no Vite needed in prod)

---

#### 18. Agora Usage API Polling (Real Minute Counts)
**What's missing:** `usageSync.ts` declares `agoraApiUrl`, `customerId`, `apiKey`, `apiSecret` fields and `getAuthHeader()` method but they are **never used**. The sync job uses `session.totalMinutes` (calculated from wall-clock time), not actual Agora-reported minutes.

**Required implementation:**
- Call Agora Console API `GET /dev/v3/usage` (or V2) with date range
- Match per-channel usage to SVSM sessions
- Use Agora-reported minutes for billing (more accurate, accounts for early disconnects)

---

#### 19. Database Migrations
**What's missing:** No Prisma migration files exist. Schema is only applied via `prisma db push`.

**Required implementation:**
- Run `npx prisma migrate dev --name init` to create migration history
- Add migration step to Docker entrypoint

---

#### 20. Request Logging & Monitoring
**What's missing:** No logging middleware (morgan, pino) or APM integration.

**Required implementation:**
- Add `morgan` or `pino-http` for structured request/response logging
- Error handler middleware (`app.use((err, req, res, next) => ...)`)

---

#### 21. Input Validation
**What's missing:** Only minimal `if (!field) return 400` checks. No schema validation library.

**Required implementation:**
- Add `zod` or `joi` schema validation for all request bodies
- Sanitize email, validate password strength on registration

---

#### 22. Rate Limiting
**What's missing:** No rate limiting on auth routes — brute force attacks possible.

**Required implementation:**
- `express-rate-limit` on `/auth/login` and `/auth/register`
- e.g., max 10 requests per 15 minutes per IP

---

## 14. Security Assessment

| Risk | Severity | Status |
|---|---|---|
| Open CORS (`cors()` with no options) | 🔴 HIGH | Unmitigated |
| Agora App ID committed to source code | 🔴 HIGH | Unmitigated |
| JWT fallback secret (`'fallback_secret_key'`) | 🔴 HIGH | Unmitigated if env not set |
| No Stripe webhook signature verification | 🔴 HIGH | Webhook not implemented |
| balance check fails open on error | 🟡 MEDIUM | Unmitigated |
| No rate limiting on auth routes | 🟡 MEDIUM | Unmitigated |
| No input validation/sanitization | 🟡 MEDIUM | Unmitigated |
| Tokens not refreshable, 1h Agora expiry | 🟡 MEDIUM | Unmitigated |
| Any authenticated user can join any session | 🟡 MEDIUM | No invitation/access control |
| localStorage for JWT (XSS exposure) | 🟡 MEDIUM | Industry tradeoff |
| No HTTPS in Docker setup | 🟡 MEDIUM | Dev only |
| `balanceAfter` always 0 (data integrity) | 🟡 MEDIUM | Logic bug |
| ts-node-dev in Docker (not production runtime) | 🟠 LOW-MED | Ops risk |

---

## 15. Known Bugs & Critical Issues

| # | Location | Bug | Impact |
|---|---|---|---|
| 1 | `usageSync.ts:64` | `balanceAfter: 0` hardcoded | Transaction history shows wrong balances |
| 2 | `billingService.ts:10` | Mock returns `$124.50` when Lago not configured | Balance check always passes in dev; misleading |
| 3 | `billingRoute.ts` | No Stripe webhook → wallet never funded | End-to-end payments broken in production |
| 4 | `sessionController.ts` | `participantCount` never incremented | Stats always show 0 participants |
| 5 | `Wallet.tsx:89` | Minutes estimate hardcoded | Always shows 41,500 regardless of balance |
| 6 | `Wallet.tsx:44-47` | Transactions are hardcoded mock data | No real billing history shown |
| 7 | `Room.tsx:14` | App ID hardcoded in source | Security exposure + rotation risk |
| 8 | `Dashboard.tsx:61` | `prompt()` for session title | Poor UX, blocked in some browser contexts |
| 9 | `Room.tsx:193` | Participant count shows `(256)` hardcoded | Always wrong |
| 10 | `authController.ts:getMe` | Reimplements JWT verification (duplicates middleware) | Code quality / maintenance debt |
| 11 | `docker-compose.yml:66` | Lago built from `../lago-api` (outside repo) | Stack fails to start without sibling repo |

---

## 16. Recommended Implementation Roadmap

### Phase 1 — Make Payments Work End-to-End (Weeks 1–2)
1. Implement **Stripe webhook handler** — credit Lago wallet on `checkout.session.completed`
2. Auto-create **Lago customer + wallet on registration**
3. Fix `balanceAfter` in usage sync job
4. Wire **real transaction history** API + frontend

### Phase 2 — Security Hardening (Week 2–3)
5. Restrict **CORS** to `FRONTEND_URL`
6. Move Agora App ID to **environment variable**
7. Add **rate limiting** (`express-rate-limit`)
8. Add **input validation** (`zod`)
9. Fix balance check to **fail-closed** on Lago error

### Phase 3 — Feature Completeness (Weeks 3–5)
10. **Real-time participant count** (Agora webhook or polling)
11. **Real-time chat** via Socket.io or Agora RTM
12. **Screen sharing** implementation
13. Session creation modal (replace `prompt()`)
14. Dashboard **search & filter** functionality
15. **Accurate minutes estimate** on wallet page
16. **Stripe Customer Portal** for payment method management

### Phase 4 — Production Readiness (Week 5–6)
17. **Production Docker builds** (compiled backend + static frontend)
18. **Database migrations** (`prisma migrate`)
19. **Agora Cloud Recording** integration
20. **Agora usage API** polling for accurate minute tracking
21. Request logging (`pino-http`) + global error middleware
22. **Agora token refresh** before 1-hour expiry

---

*Documentation generated April 2026 from full source code analysis of the SVSM monorepo.*
