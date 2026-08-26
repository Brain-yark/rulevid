# 🎥 SVSM 2.0 — Streaming Video Session Manager & Live Experience Platform

> **Version:** 2.0 (Live Experience Engine & Monetization Phase)  
> **Architecture:** Decoupled React 19 Frontend + Express 5 REST API + Agora RTC (WebRTC) + Agora Chat + Stripe Payments & Lago Prepaid Infrastructure Billing  
> **Status:** Production-Ready Live Event Marketplace & B2B Host Studio

---

## 📋 Table of Contents

- [Overview & Evolution](#-overview--evolution)
- [System Architecture](#-system-architecture)
- [Product Roles & Permissions Matrix](#-product-roles--permissions-matrix)
- [Key Features & Capabilities](#-key-features--capabilities)
- [Live Event & Session Lifecycle](#-live-event--session-lifecycle)
- [Database Schema (Prisma Models)](#-database-schema-prisma-models)
- [API Reference](#-api-reference)
- [Technology Stack](#-technology-stack)
- [Environment Configuration](#-environment-configuration)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Docker & Containerized Deployment](#-docker--containerized-deployment)
- [Security & Production Hardening](#-security--production-hardening)

---

## 🌟 Overview & Evolution

**SVSM 2.0** evolves from a white-label video infrastructure management tool into a comprehensive **Live Experience & Community Marketplace Platform**.

The platform merges two critical engines:
1. **Live Experience Engine**: Ultra-low-latency HD WebRTC video broadcasting via Agora RTC, combined with real-time in-room text chat (Agora Chat SDK) and automated cloud recording.
2. **Monetization & Entitlement Engine**: Server-authoritative paid seat ticketing via Stripe Checkout, host revenue tracking, and a decoupled prepaid infrastructure usage metering ledger powered by Lago.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SVSM 2.0 PLATFORM                             │
├───────────────────────────────────┬─────────────────────────────────────┤
│      MARKETPLACE & EXPERIENCES    │     INFRASTRUCTURE USAGE LEDGER     │
│  - Paid Live Events & Tickets     │  - Real-Time Metered Video Minutes  │
│  - Host Monetization & Studio     │  - Lago Customer Wallets            │
│  - Public Discovery & Checkout    │  - Standard ($0.003) & Premium Tier │
│  - Agora RTC Interactive Rooms    │  - Stripe Balance Auto-Topup        │
└───────────────────────────────────┴─────────────────────────────────────┘
```

---

## 🏗️ System Architecture

```
                                  ┌───────────────────────────┐
                                  │   Web / Mobile Clients    │
                                  │   (React 19 + TypeScript) │
                                  └─────────────┬─────────────┘
                                                │ :80 / :5173
                                  ┌─────────────▼─────────────┐
                                  │   Nginx Reverse Proxy     │
                                  │   (SPA & API Gateway)     │
                                  └──────┬─────────────┬──────┘
                             /api/       │             │ /
                    ┌────────────────────▼┐           ┌▼───────────────────┐
                    │  Backend Service    │           │  Frontend SPA      │
                    │  Express 5 + TS     │           │  Vite 8 + React 19 │
                    │  Port: 3001         │           │  Port: 5173 / :80  │
                    └──────────┬──────────┘           └────────────────────┘
                               │
       ┌───────────────────────┼──────────────────────────────┐
       │                       │                              │
       ▼                       ▼                              ▼
┌──────────────┐       ┌──────────────┐               ┌──────────────┐
│  PostgreSQL  │       │  Redis / WS  │               │ Agora Cloud  │
│  SVSM DB     │       │  Socket.io   │               │ RTC & Chat   │
│  (Prisma 7)  │       │  (Presence)  │               │ (WebRTC HD)  │
└──────────────┘       └──────────────┘               └──────────────┘
       │                       │
       ▼                       ▼
┌──────────────┐       ┌──────────────┐
│ Stripe API   │       │ Lago Billing │
│ (Checkout)   │       │ (Usage API)  │
└──────────────┘       └──────────────┘
```

---

## 👥 Product Roles & Permissions Matrix

| Capability | Attendee (User) | Host (Facilitator) | Moderator | Super Admin |
|---|:---:|:---:|:---:|:---:|
| **Discover Public Events** | ✅ | ✅ | ✅ | ✅ |
| **Filter Upcoming vs Ended Events** | ✅ | ✅ | ✅ | ✅ |
| **Purchase Paid Event Tickets** | ✅ | ✅ | ✅ | ✅ |
| **Join Live Video Stream (with Ticket)** | ✅ | ✅ | ✅ | ✅ |
| **Participate in In-Room Agora Chat** | ✅ | ✅ | ✅ | ✅ |
| **1-Click Upgrade to Host ("Host an Event")** | ✅ | — | — | — |
| **Create & Save Draft Events** | ❌ | ✅ | ✅ | ✅ |
| **Set Ticket Pricing & Seat Capacity** | ❌ | ✅ | ✅ | ✅ |
| **Publish Live Events** | ❌ | ✅ | ✅ | ✅ |
| **Launch Live Stream (15-min Window Buffer)** | ❌ | ✅ | ✅ | ✅ |
| **End Live Stream for All Participants** | ❌ | ✅ | ✅ | ✅ |
| **View Ticket Sales & Revenue Metrics** | ❌ | ✅ | ✅ | ✅ |
| **Manage Prepaid Lago Wallet & Balance** | ❌ | ✅ | ✅ | ✅ |
| **Manage Platform Users & Roles** | ❌ | ❌ | ❌ | ✅ |
| **Configure Host Pricing Tiers** | ❌ | ❌ | ❌ | ✅ |
| **Trigger System Ledger Sync** | ❌ | ❌ | ❌ | ✅ |

---

## ✨ Key Features & Capabilities

### 1. 🎟️ Paid Seats & Server-Authoritative Entitlements
- **Zero Client Trust:** Agora RTC tokens are generated only after verifying user identity, event state, and confirmed ticket ownership.
- **Instant Free Tickets:** $0 events bypass checkout and issue verified access tickets immediately.
- **Stripe Checkout Integration:** Automatic webhook confirmation and pending-to-paid state transition.

### 2. 📺 Host Studio & Live Broadcasting
- **Schedule Window Buffer:** Host can start a broadcast up to **15 minutes** before the scheduled time for camera/mic setup; premature start attempts are prevented.
- **Sales Analytics:** Real-time metrics tracking total gross ticket sales, paid ticket counts, and seat capacity progress bars.
- **Instant Publishing:** Save as draft or 1-click publish to the public discovery feed.

### 3. 🔒 Strict Concluded Event Guardrails
- **Permanent Lockout:** Once an event is ended (`status === 'ended'`), nobody (neither attendee nor host) can enter, join, or restart the session.
- **Clean UI Feedback:** Concluded event cards are desaturated with a `🔒 Event Ended` badge, removing all action buttons.

### 4. 🗂️ Default Attendee Feed (Live & Upcoming First)
- **Filtered Default:** Attendees land on the **`🟢 Upcoming & Live`** tab by default so past sessions do not clutter active discovery.
- **Historical Filter:** Past events can be explored at any time via the **"All"** or **"Ended"** tabs.

### 5. 💳 Decoupled Prepaid Infrastructure Metering (Lago)
- **Usage Metering:** Video usage is metered per active minute at **$0.003/min** (Standard) or **$0.004/min** (Premium).
- **Automated Wallet Deductions:** Dedicated wallets maintained in Lago with automatic balance tracking and Stripe top-ups.

---

## 🔄 Live Event & Session Lifecycle

```
 ┌──────────┐      Host Action: Publish      ┌─────────────┐
 │  DRAFT   ├───────────────────────────────►│  PUBLISHED  │
 └────┬─────┘                                └──────┬──────┘
      │                                             │
      │ Delete (if no sales)                        │ 15m Buffer + Host Goes Live
      ▼                                             ▼
 ┌──────────┐                                ┌─────────────┐
 │ DELETED  │                                │    LIVE     │
 └──────────┘                                └──────┬──────┘
                                                    │
                                                    │ Host Action: End Event
                                                    ▼
                                             ┌─────────────┐
                                             │    ENDED    │ ◄── (PERMANENTLY LOCKED)
                                             └─────────────┘     No entry / No restart
```

---

## 🗄️ Database Schema (Prisma Models)

The core relational models defined in `backend/prisma/schema.prisma`:

```prisma
model User {
  id               String        @id @default(uuid())
  email            String        @unique
  passwordHash     String
  name             String?
  role             String        @default("user") // user, host, moderator, admin, super_admin
  emailVerified    Boolean       @default(false)
  lastLoginAt      DateTime?
  companyName      String?
  walletId         String?
  stripeCustomerId String?
  pricingTier      String        @default("standard")
  status           String        @default("active")
  sessions         Session[]     @relation("FacilitatorSessions")
  eventsHosted     Event[]       @relation("FacilitatorEvents")
  tickets          Ticket[]
  transactions     Transaction[]
  usageRecords     UsageRecord[]
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
}

model Event {
  id            String    @id @default(uuid())
  facilitator   User      @relation("FacilitatorEvents", fields: [facilitatorId], references: [id])
  facilitatorId String
  title         String
  description   String?
  startsAt      DateTime
  status        String    @default("draft") // draft, published, live, ended, cancelled
  priceCents    Int       @default(0)
  capacity      Int?
  session       Session?  @relation(fields: [sessionId], references: [id])
  sessionId     String?   @unique
  tickets       Ticket[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Ticket {
  id                      String   @id @default(uuid())
  event                   Event    @relation(fields: [eventId], references: [id])
  eventId                 String
  user                    User     @relation(fields: [userId], references: [id])
  userId                  String
  stripeCheckoutSessionId String?  @unique
  stripePaymentIntentId   String?
  status                  String   @default("pending") // pending, paid, refunded, cancelled
  amountCents             Int
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

---

## 📡 API Reference

### Authentication (`/api/v1/auth`)
- `POST /register` — Register a new account (`user` or `host`).
- `POST /login` — Authenticate and receive signed JWT.
- `GET /me` — Fetch current user profile, role, and wallet info.

### Events (`/api/v1/events`)
- `GET /` — List events (`view=mine` for host's studio, public otherwise; supports `search` and `status` query params).
- `POST /` — Create a new event draft (elevates attendee to host).
- `GET /:id` — Retrieve full event details, ticket state, and timing buffer.
- `PUT /:id` — Update event metadata (title, price, date, capacity).
- `DELETE /:id` — Hard-delete event (or soft-cancel if tickets were sold).
- `PATCH /:id/publish` — Publish draft event for discovery and sales.
- `POST /:id/checkout` — Initiate Stripe Checkout session for a ticket.
- `POST /:id/start` — Host launches live broadcast (enforces 15-min buffer).
- `POST /:id/join` — Join live stream (authoritative ticket verification).
- `POST /:id/end` — Conclude live event permanently.

### Billing & Wallet (`/api/v1/billing`)
- `GET /balance` — Fetch current Lago prepaid wallet balance.
- `POST /topup` — Initiate Stripe Checkout for prepaid credit balance.
- `POST /webhook` — Stripe webhook listener for checkout confirmations.
- `POST /sync-usage` — Trigger usage reconciliation with Lago.

### Super Admin (`/api/v1/admin`)
- `GET /metrics` — Platform-wide metrics (hosts, streams, revenue, usage).
- `GET /hosts` — List all registered hosts with wallet balances and tiers.
- `PATCH /hosts/:id/tier` — Update host pricing tier (`standard` / `premium`).
- `POST /hosts/:id/topup` — Manually credit a host's wallet.
- `GET /audit-logs` — Review administrative action logs.

---

## 💻 Technology Stack

- **Frontend:** React 19, TypeScript, Vite 8, Agora RTC React SDK, Agora Chat SDK, Lucide Icons.
- **Backend:** Node.js 20 LTS, Express 5, TypeScript, Prisma ORM 7, Zod, JWT, bcryptjs.
- **Database & Cache:** PostgreSQL 16, Redis 7.
- **External Services:** Agora RTC (WebRTC Video), Agora Chat, Stripe API & Webhooks, Lago Billing Engine.

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```env
PORT=3001
NODE_ENV=development
DATABASE_URL="postgresql://svsm_user:svsm_password@localhost:5432/svsm_db?schema=public"
JWT_SECRET="your_jwt_secret_key"
FRONTEND_URL="http://localhost:5173"

# Agora WebRTC & Chat
AGORA_APP_ID="your_agora_app_id"
AGORA_APP_CERTIFICATE="your_agora_app_certificate"
AGORA_CHAT_APP_KEY="your_agora_chat_app_key"
AGORA_CHAT_CLIENT_ID="your_chat_client_id"
AGORA_CHAT_CLIENT_SECRET="your_chat_client_secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Lago Metering
LAGO_API_URL="http://localhost:3000"
LAGO_API_KEY="your_lago_api_key"
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE="http://localhost:3001"
VITE_AGORA_APP_ID="your_agora_app_id"
VITE_AGORA_CHAT_APP_KEY="your_agora_chat_app_key"
```

---

## 🚀 Getting Started & Local Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/web-mastershashaval/svsm_version2-.git
cd svsm

# Install root, backend, and frontend dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Database Migration
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

### 3. Run Development Servers
```bash
# Run both Backend (:3001) and Frontend (:5173) concurrently
npm run dev
```

---

## 🐳 Docker & Containerized Deployment

To spin up the complete SVSM ecosystem including PostgreSQL, Redis, Lago, Backend, and Frontend:

```bash
docker compose up -d --build
```

---

## 🛡️ Security & Production Hardening

- **JWT Expiration & Verification:** Short-lived access tokens with cryptographic verification on all authenticated routes.
- **Rate Limiting:** Protects auth endpoints against brute-force attacks via `express-rate-limit`.
- **Server-Authoritative Time Windows:** Scheduled event start times cannot be bypassed by manipulating client clocks.
- **Signed Stripe Webhooks:** Every payment confirmation verifies raw cryptographic signatures before granting ticket access.