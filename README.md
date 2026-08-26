# 🎥 SVSM — Streaming Video Session Manager

> **Version:** 1.0 (MVP Phase)  
> **Architecture:** Decoupled React 19 Frontend + Express 5 Backend + Agora RTC WebRTC + Stripe & Lago Prepaid Billing  
> **Status:** Production-Ready MVP Baseline

---

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Database Schema (Data Models)](#database-schema-data-models)
- [API Reference](#api-reference)
- [Environment Configuration](#environment-configuration)
- [Getting Started & Local Setup](#getting-started--local-setup)
- [Container Deployment & Docker](#container-deployment--docker)
- [Security & Production Hardening](#security--production-hardening)

---

## 🌟 Overview

**SVSM** (**S**treaming **V**ideo **S**ession **M**anager) is a white-label, enterprise B2B SaaS platform enabling businesses ("Facilitators") to launch, host, manage, and monetize live video streaming sessions.

The platform utilizes a **pre-paid wallet model**: facilitators add credits to their wallet via **Stripe Checkout**, and live video usage is metered per-minute using **Lago** (open-source billing engine) and **Agora RTC** (global WebRTC infrastructure).

### Core Pricing Tiers
- **Standard Tier**: `$0.003 / minute` per active stream
- **Premium Tier**: `$0.004 / minute` per active stream (includes high-res stream & priority routing)

---

## 🏗️ System Architecture

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

     External Infrastructure:
     ┌─────────────────┐    ┌─────────────────┐
     │  Agora RTC      │    │  Stripe         │
     │  (WebRTC Media) │    │  (Checkout)     │
     └─────────────────┘    └─────────────────┘
```

---

## 🛠️ Technology Stack

### Backend Services
| Layer | Technology | Purpose |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Non-blocking server runtime |
| Web Framework | **Express 5** | High-performance HTTP server & REST routing |
| Language | **TypeScript 6** | End-to-end type safety |
| Database ORM | **Prisma 7** + `@prisma/adapter-pg` | PostgreSQL ORM & connection pooling |
| Authentication | **JSON Web Tokens (JWT)** | Bearer-token session verification |
| Video Tokens | **`agora-access-token`** | Time-bounded Agora RTC access tokens |
| Payments & Billing | **Stripe API + Lago REST Client** | Payment checkout & automated usage metering |
| Job Scheduler | **`node-cron`** | Daily usage sync cron jobs |

### Frontend Application
| Layer | Technology | Purpose |
|---|---|---|
| UI Framework | **React 19** | Component-driven user interface |
| Build Tool | **Vite 8** | Ultra-fast HMR and bundle optimization |
| Media SDK | **Agora RTC React 2** + **SDK NG** | Direct client WebRTC video streaming |
| Realtime Chat | **Agora Chat SDK** + **Socket.io** | Low-latency in-room text chat |
| Iconography & Motion | **Lucide React** & **Framer Motion** | UI components, icons, and micro-interactions |

---

## ✨ Key Features

- **Instant Session Launch**: Facilitators create sessions via a glassmorphic dashboard modal.
- **Agora WebRTC Integration**: Low-latency global video channels with auto-renewing RTC tokens.
- **In-Room Live Chat**: Real-time broadcast text messaging during active sessions.
- **Pre-Paid Wallet & Metering**: Minimum balance guards ($5 guard) prevent unauthorized stream execution.
- **Stripe Top-Up Integration**: Instant wallet credit purchases via Stripe Checkout sessions.
- **One-Click Link Sharing**: Copyable participant join links with visual copy feedback.

---

## 📊 Database Schema (Data Models)

The backend interacts with **PostgreSQL** via Prisma. Below are the primary entity models:

### 1. `User` Model
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `passwordHash` (String, bcrypt salt 10)
- `companyName` (Optional String)
- `pricingTier` (`"standard"` | `"premium"`, Default: `"standard"`)
- `status` (`"active"` | `"suspended"`, Default: `"active"`)
- `walletId` (Optional String reference to Lago Wallet)
- `stripeCustomerId` (Optional String)

### 2. `Session` Model
- `id` (UUID, Primary Key)
- `title` (String)
- `channelName` (String, Unique channel key format `f_{userId}_{rand}_{ts}`)
- `status` (`"scheduled"` | `"active"` | `"ended"`)
- `startedAt` / `endedAt` (DateTime, Nullable)
- `totalMinutes` (Integer duration calculated on session close)
- `facilitatorId` (Foreign Key → `User.id`)

### 3. `Transaction` Model
- `id` (UUID, Primary Key)
- `type` (`"topup"` | `"deduction"`)
- `amount` (Float, positive for topups, negative for deductions)
- `balanceAfter` (Float)
- `description` (Optional String)
- `userId` (Foreign Key → `User.id`)

### 4. `UsageRecord` Model
- `minutesUsed` (Integer)
- `costToFacilitator` (Float, calculated as `minutes × ratePerMinute`)
- `ratePerMinute` (Float: `0.003` or `0.004`)
- `syncedAt` (DateTime, timestamp of Lago sync)
- `sessionId` (Foreign Key → `Session.id`)
- `userId` (Foreign Key → `User.id`)

---

## 🔌 API Reference

### Auth Endpoints (`/api/v1/auth`)
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/register` | No | Register a new facilitator account |
| `POST` | `/login` | No | Authenticate and retrieve JWT Bearer token |
| `GET` | `/me` | Yes | Validate current token and fetch user profile |

### Session Endpoints (`/api/v1/sessions`)
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/` | Yes | List facilitator sessions |
| `POST` | `/` | Yes | Create new session (requires balance >= $5.00) |
| `POST` | `/:id/join` | Yes | Retrieve RTC token & transition session to active |
| `POST` | `/:id/end` | Yes | End active session & calculate total duration |

### Billing Endpoints (`/api/v1/billing`)
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/balance` | Yes | Get wallet credit balance & pricing tier |
| `POST` | `/topup` | Yes | Generate Stripe Checkout URL for wallet top-up |
| `GET` | `/transactions` | Yes | Retrieve transaction ledger history |

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root based on `.env.example`:

```env
# Backend Environment
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secure-jwt-secret-key-min-32-chars

# Database Connection
DATABASE_URL=postgresql://svsm_user:svsm_password@localhost:5432/svsm_db?schema=public

# Agora RTC Credentials
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGORA_CHAT_APP_KEY=your_agora_chat_app_key

# Stripe Payment Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:8080

# Lago Billing Integration
LAGO_API_URL=http://localhost:3000
LAGO_API_KEY=your_lago_api_key
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: Recommended for running full database and services stack

### 1. Repository Installation
```bash
git clone https://github.com/your-org/svsm.git
cd svsm
npm install
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend SPA will run locally on `http://localhost:5173` (or `http://localhost:80` inside Docker).

### 3. Backend Setup
```bash
cd ../backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```
The backend API server will listen on `http://localhost:3001`.

---

## 🐳 Container Deployment & Docker

Run the entire multi-service stack using Docker Compose:

```bash
docker-compose up -d --build
```

### Included Services:
- `proxy`: Nginx ingress gateway on port `8080`
- `frontend`: React SPA service
- `backend`: Node/Express API server
- `db`: PostgreSQL 15 database container
- `lago-db` & `lago-redis`: Lago metering datastores

---

## 🛡️ Security & Production Hardening

1. **CORS Configuration**: Restrict origin credentials in production to matching frontend domains.
2. **Environment Secrets**: Never commit `.env` files or raw RSA keys to version control.
3. **Database Guardrails**: Utilize automated migration pipelines (`npx prisma migrate deploy`) in CI/CD.
4. **Token Security**: Agora tokens are set with a strict 1-hour expiration and auto-refreshed prior to expiry.
#   s v s m _ v e r s i o n 2 -  
 