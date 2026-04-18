File 1: README.md
markdown
# Live Streaming & Video Call Platform - Complete Blueprint

## Project Overview
A white-label platform for reselling Agora video/voice minutes with Lago billing.

**Business Model**: Buy minutes from Agora ($2/1000 min), resell to facilitators ($3-4/1000 min)

**Key Features**:
- Video/voice calls supporting 300 participants
- Real-time chat
- Pre-paid wallet system
- Automated billing with Lago + Stripe

## Quick Navigation
- [Architecture Overview](./01_ARCHITECTURE_OVERVIEW.md)
- [Database Schema](./02_DATABASE_SCHEMA.sql)
- [API Specification](./03_API_SPECIFICATION.md)
- [Agora Integration](./04_AGORA_INTEGRATION.md)
- [Lago Billing Setup](./05_LAGO_BILLING_SETUP.md)
- [Frontend Guide](./06_FRONTEND_GUIDE.md)
- [Deployment Checklist](./07_DEPLOYMENT_CHECKLIST.md)
- [Implementation Timeline](./09_IMPLEMENTATION_TIMELINE.md)

## Environment Variables Needed
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
AGORA_CUSTOMER_ID=your_customer_id
AGORA_API_KEY=your_api_key
LAGO_API_URL=https://api.getlago.com
LAGO_API_KEY=your_lago_key
STRIPE_SECRET_KEY=sk_live_xxx
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your_jwt_secret

text

## Contact & Support
- Agora Support: https://agora.io/support
- Lago Documentation: https://docs.getlago.com
- Stripe Dashboard: https://dashboard.stripe.com
📄 File 2: 01_ARCHITECTURE_OVERVIEW.md
markdown
# Architecture Overview

## High-Level Architecture
┌─────────────────────────────────────────────────────────────┐
│ YOUR PLATFORM │
├─────────────────────────────────────────────────────────────┤
│ Web Client ──▶ API Gateway ──▶ Backend Services │
│ │ │
│ ▼ │
│ ┌──────────┬──────────┬──────────┬──────────┐ │
│ │PostgreSQL│ Redis │ RabbitMQ│ S3 │ │
│ └──────────┴──────────┴──────────┴──────────┘ │
├─────────────────────────────────────────────────────────────┤
│ EXTERNAL SERVICES │
├─────────────────────────────────────────────────────────────┤
│ Agora (Video/Voice) │ Lago (Billing) │ Stripe (Payments) │
└─────────────────────────────────────────────────────────────┘

text

## Component Responsibilities

### 1. Backend Services (Node.js + Express)

| Service | Port | Purpose |
|---------|------|---------|
| Auth Service | 3001 | JWT tokens, user login |
| Room Service | 3002 | Channel management, Agora tokens |
| Chat Service | 3003 | WebSocket, message routing |
| Billing Service | 3004 | Lago sync, wallet checks |
| Admin Service | 3005 | Analytics, facilitator management |

### 2. Database (PostgreSQL)

**Primary tables**:
- `facilitators` - Customer accounts
- `end_users` - Users under each facilitator
- `sessions` - Video call sessions
- `usage_records` - Minute tracking
- `wallet_transactions` - Payment history

### 3. Cache (Redis)

**Used for**:
- Session state (TTL: 1 hour)
- Chat message pub/sub
- Rate limiting counters
- Agora token cache

### 4. Message Queue (RabbitMQ)

**Used for**:
- Async Agora usage sync
- Email notifications
- Invoice generation

## Data Flow: Usage Deduction
Daily at 02:00 UTC:

Cron job queries Agora API

Parses channel names → facilitator_id

Groups minutes by facilitator

Calculates cost ($0.003/min)

Sends event to Lago

Lago deducts from wallet

System checks for low balance

Sends top-up alert if needed

text

## Scaling Strategy

| Component | Scaling Method |
|-----------|---------------|
| API Servers | Horizontal (add more instances) |
| Database | Read replicas |
| Redis | Cluster mode |
| WebSocket | Sticky sessions + Redis adapter |

## Security Layers

1. **JWT Authentication** - All API endpoints
2. **Agora Token** - Generated server-side only
3. **Rate Limiting** - 100 req/min per IP
4. **CORS** - Whitelist your domains only
5. **Input Validation** - All channel names sanitized
📄 File 3: 02_DATABASE_SCHEMA.sql
sql
-- Complete Database Schema for Agora Reseller Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. FACILITATORS TABLE (Your customers)
CREATE TABLE facilitators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    wallet_id VARCHAR(100),  -- Reference to Lago wallet
    stripe_customer_id VARCHAR(100),
    pricing_tier VARCHAR(50) DEFAULT 'standard',  -- standard: $3, premium: $4
    status VARCHAR(50) DEFAULT 'active',  -- active, suspended, pending
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- 2. END_USERS TABLE (Users under each facilitator)
CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID REFERENCES facilitators(id) ON DELETE CASCADE,
    email VARCHAR(255),
    display_name VARCHAR(100),
    user_role VARCHAR(50) DEFAULT 'participant',  -- host, co-host, audience
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP
);

-- 3. SESSIONS TABLE (Video call rooms)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID REFERENCES facilitators(id) ON DELETE CASCADE,
    channel_name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    participant_count INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    recording_url TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',  -- scheduled, active, ended, recorded
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_facilitator_sessions (facilitator_id),
    INDEX idx_channel_name (channel_name),
    INDEX idx_status (status)
);

-- 4. PARTICIPANTS TABLE (Who joined which session)
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    end_user_id UUID REFERENCES end_users(id),
    user_id VARCHAR(100),  -- Agora user ID
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,
    role VARCHAR(50) DEFAULT 'audience',  -- host, co-host, audience
    INDEX idx_session_participants (session_id)
);

-- 5. USAGE_RECORDS TABLE (Minutes tracked from Agora)
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID REFERENCES facilitators(id),
    session_id UUID REFERENCES sessions(id),
    minutes_used INTEGER NOT NULL,
    cost_to_platform DECIMAL(10,4),  -- Your cost from Agora
    billed_to_customer DECIMAL(10,4), -- What you charge
    profit DECIMAL(10,4),
    rate_per_minute DECIMAL(10,4),  -- $0.003 for standard tier
    sync_status VARCHAR(50) DEFAULT 'pending',  -- pending, synced, failed
    sync_attempts INTEGER DEFAULT 0,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_facilitator_usage (facilitator_id),
    INDEX idx_sync_status (sync_status),
    INDEX idx_created_at (created_at)
);

-- 6. WALLET_TRANSACTIONS TABLE (Local cache of Lago data)
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID REFERENCES facilitators(id),
    lago_transaction_id VARCHAR(100),
    transaction_type VARCHAR(50),  -- topup, deduction, refund, adjustment
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    balance_after DECIMAL(10,2),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    INDEX idx_facilitator_wallet (facilitator_id),
    INDEX idx_status (status)
);

-- 7. CHAT_MESSAGES TABLE
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    end_user_id UUID REFERENCES end_users(id),
    facilitator_id UUID REFERENCES facilitators(id),
    message TEXT,
    message_type VARCHAR(50) DEFAULT 'text',  -- text, image, file, system
    file_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_chat (session_id),
    INDEX idx_created_at (created_at)
);

-- 8. INVOICES TABLE (Local cache of Lago invoices)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID REFERENCES facilitators(id),
    lago_invoice_id VARCHAR(100),
    invoice_number VARCHAR(50),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50),  -- draft, finalized, void, paid
    issued_at TIMESTAMP,
    paid_at TIMESTAMP,
    due_date DATE,
    invoice_pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_facilitator_invoices (facilitator_id),
    INDEX idx_status (status)
);

-- 9. API_KEYS TABLE (For facilitator API access)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facilitator_id UUID REFERENCES facilitators(id) ON DELETE CASCADE,
    key_name VARCHAR(100),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_secret VARCHAR(64) NOT NULL,
    permissions JSONB DEFAULT '["read_usage", "create_sessions"]',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_api_key (api_key)
);

-- 10. SYSTEM_LOGS TABLE
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    log_level VARCHAR(20),  -- info, warning, error
    service VARCHAR(50),    -- auth, billing, chat, agora-sync
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_log_level (log_level),
    INDEX idx_created_at (created_at)
);

-- Create indexes for performance
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_usage_records_facilitator_date ON usage_records(facilitator_id, created_at);
CREATE INDEX idx_wallet_transactions_facilitator_date ON wallet_transactions(facilitator_id, created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to facilitators
CREATE TRIGGER update_facilitators_updated_at 
    BEFORE UPDATE ON facilitators 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Seed data for testing
INSERT INTO facilitators (email, password_hash, company_name, pricing_tier) 
VALUES ('test@example.com', '$2a$10$test_hash', 'Test Company', 'standard');

-- Add constraint to ensure positive wallet amounts
ALTER TABLE wallet_transactions ADD CONSTRAINT positive_amount CHECK (amount >= 0);
ALTER TABLE usage_records ADD CONSTRAINT positive_minutes CHECK (minutes_used >= 0);
📄 File 4: 03_API_SPECIFICATION.md
markdown
# API Specification

## Base URL
https://api.yourplatform.com/v1

text

## Authentication
All endpoints (except login/register) require Bearer token:
Authorization: Bearer <jwt_token>

text

## Endpoints

### 1. Authentication

#### POST /auth/register
Register a new facilitator

**Request**:
```json
{
    "email": "facilitator@example.com",
    "password": "securepassword",
    "company_name": "Company Name"
}
Response:

json
{
    "user_id": "uuid",
    "email": "facilitator@example.com",
    "api_key": "generated_api_key"
}
POST /auth/login
Login existing user

Request:

json
{
    "email": "facilitator@example.com",
    "password": "securepassword"
}
Response:

json
{
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 86400
}
2. Sessions (Video Calls)
POST /sessions/create
Create a new video session

Request:

json
{
    "title": "Weekly Team Meeting",
    "max_participants": 300,
    "auto_record": false
}
Response:

json
{
    "session_id": "uuid",
    "channel_name": "fac_101_sess_abc123",
    "agora_token": "generated_token",
    "join_url": "https://yourplatform.com/join/session_id",
    "expires_at": "2025-01-16T02:00:00Z"
}
GET /sessions/{session_id}/token
Generate new Agora token for an existing session

Response:

json
{
    "agora_token": "new_token",
    "expires_at": "2025-01-16T02:00:00Z"
}
POST /sessions/{session_id}/end
End an active session

Response:

json
{
    "status": "ended",
    "total_minutes": 12500,
    "participant_count": 45
}
3. Wallet & Billing
GET /wallet/balance
Get current wallet balance

Response:

json
{
    "balance": 124.50,
    "currency": "USD",
    "pending_deductions": 0,
    "last_updated": "2025-01-15T02:00:00Z"
}
POST /wallet/topup
Create a top-up checkout session

Request:

json
{
    "amount": 100.00,
    "success_url": "https://yourplatform.com/wallet/success",
    "cancel_url": "https://yourplatform.com/wallet/cancel"
}
Response:

json
{
    "checkout_url": "https://checkout.stripe.com/...",
    "session_id": "stripe_session_id"
}
GET /wallet/transactions
Get transaction history

Query params:

limit (default 20)

offset (default 0)

type (topup, deduction, all)

Response:

json
{
    "transactions": [
        {
            "id": "uuid",
            "type": "topup",
            "amount": 100.00,
            "balance_after": 150.00,
            "created_at": "2025-01-15T10:00:00Z"
        }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0
}
4. Usage & Analytics
GET /usage/daily
Get daily usage for current facilitator

Query params:

start_date (YYYY-MM-DD)

end_date (YYYY-MM-DD)

Response:

json
{
    "total_minutes": 12500,
    "total_cost": 37.50,
    "daily_breakdown": [
        {
            "date": "2025-01-15",
            "minutes": 12500,
            "cost": 37.50,
            "sessions": 3
        }
    ]
}
GET /usage/current-month
Get current month usage summary

Response:

json
{
    "minutes_used": 12500,
    "projected_minutes": 37500,
    "cost_incurred": 37.50,
    "projected_cost": 112.50,
    "wallet_balance": 124.50,
    "estimated_days_remaining": 15
}
5. Chat
WebSocket Connection
text
ws://yourplatform.com/chat?session_id={session_id}&token={jwt_token}
Message format:

json
{
    "type": "message",
    "data": {
        "message_id": "uuid",
        "sender_id": "user_uuid",
        "sender_name": "John Doe",
        "content": "Hello everyone!",
        "timestamp": "2025-01-15T10:00:00Z"
    }
}
System message format:

json
{
    "type": "system",
    "data": {
        "event": "user_joined",
        "user_id": "user_uuid",
        "user_name": "John Doe"
    }
}
6. Admin Endpoints (Your internal use)
GET /admin/facilitators
List all facilitators

Response:

json
{
    "facilitators": [
        {
            "id": "uuid",
            "email": "facilitator@example.com",
            "company_name": "Company",
            "wallet_balance": 124.50,
            "total_minutes_ytd": 125000,
            "status": "active"
        }
    ]
}
POST /admin/sync-usage
Manually trigger usage sync

Response:

json
{
    "status": "started",
    "facilitators_processed": 15,
    "minutes_synced": 12500
}
Error Codes
Code	Description
400	Bad Request - Invalid parameters
401	Unauthorized - Invalid or missing token
403	Forbidden - Insufficient permissions
404	Not Found - Resource doesn't exist
402	Payment Required - Insufficient wallet balance
429	Too Many Requests - Rate limit exceeded
500	Internal Server Error
Rate Limits
Endpoint Group	Limit
Authentication	10 requests/minute
Session creation	30 requests/minute
Wallet operations	60 requests/minute
Usage queries	100 requests/minute
Chat (WebSocket)	100 messages/minute
text

---

## 📄 File 5: `04_AGORA_INTEGRATION.md`

```markdown
# Agora Integration Complete Guide

## Prerequisites

1. **Create Agora Account**: https://console.agora.io
2. **Enable Analytics (水晶球)**: Required for usage tracking
3. **Get Credentials**:
   - App ID
   - App Certificate
   - Customer ID (for API access)
   - API Key & Secret

## Agora Console Setup Steps

### Step 1: Create Project
1. Go to Project Management
2. Click "Create Project"
3. Select "Secure Mode" (App ID + Certificate)
4. Enable "Recording" if needed
5. Save your App ID and App Certificate

### Step 2: Enable Analytics
1. Navigate to "Operations → Agora Analytics (水晶球)"
2. Click "Enable"
3. Select your project
4. Wait 5-10 minutes for activation

### Step 3: Generate API Credentials
1. Go to "Settings → RESTful API"
2. Click "Add API Key"
3. Copy Customer ID, API Key, and API Secret
4. Save these securely

## Channel Naming Convention (CRITICAL)

Your channel names MUST follow this pattern for attribution:
format: f_{facilitator_id}{session_id}{timestamp}

Examples:

f_101_abc123_20250115

f_102_weekly_meeting

f_103_workshop_jan

Your backend will parse the facilitator_id from the channel name:
const facilitatorId = channelName.split('_')[1];

text

## Token Generation (Server-side)

### Installation
```bash
npm install agora-access-token
Token Generation Code
javascript
// services/agoraTokenService.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

class AgoraTokenService {
    constructor() {
        this.appId = process.env.AGORA_APP_ID;
        this.appCertificate = process.env.AGORA_APP_CERTIFICATE;
    }

    generateToken(channelName, userId, role = 'publisher') {
        const uid = userId.toString();
        const roleNum = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
        const expireTime = 3600; // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expireTime;

        const token = RtcTokenBuilder.buildTokenWithUid(
            this.appId,
            this.appCertificate,
            channelName,
            uid,
            roleNum,
            privilegeExpiredTs
        );

        return {
            token,
            expiresAt: privilegeExpiredTs,
            channelName,
            uid
        };
    }
}

module.exports = new AgoraTokenService();
Usage in API endpoint
javascript
// routes/sessions.js
app.post('/sessions/create', async (req, res) => {
    const { facilitatorId } = req.user;
    const { title } = req.body;
    
    // Create unique channel name
    const sessionId = uuidv4();
    const channelName = `f_${facilitatorId}_${sessionId}_${Date.now()}`;
    
    // Generate token for the facilitator (host)
    const tokenData = agoraTokenService.generateToken(
        channelName,
        facilitatorId,
        'publisher'
    );
    
    // Save session to database
    const session = await db.sessions.create({
        facilitator_id: facilitatorId,
        channel_name: channelName,
        title,
        status: 'active'
    });
    
    res.json({
        session_id: session.id,
        channel_name: channelName,
        agora_token: tokenData.token,
        expires_at: tokenData.expiresAt
    });
});
Usage Tracking via API
Query Daily Usage
javascript
// services/agoraUsageService.js
const axios = require('axios');

class AgoraUsageService {
    constructor() {
        this.apiUrl = 'https://api.agora.io/dev/v3';
        this.customerId = process.env.AGORA_CUSTOMER_ID;
        this.apiKey = process.env.AGORA_API_KEY;
        this.apiSecret = process.env.AGORA_API_SECRET;
    }

    getAuthHeader() {
        const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
        return `Basic ${auth}`;
    }

    async getDailyUsage(startTs, endTs) {
        const url = `${this.apiUrl}/usage`;
        const response = await axios.get(url, {
            params: {
                startTs,
                endTs,
                customerId: this.customerId
            },
            headers: {
                'Authorization': this.getAuthHeader()
            }
        });
        
        return response.data;
    }

    async getUsageForFacilitator(facilitatorId, startTs, endTs) {
        const allUsage = await this.getDailyUsage(startTs, endTs);
        
        // Filter usage by channel name pattern
        const facilitatorUsage = allUsage.data.filter(record => 
            record.channelName.startsWith(`f_${facilitatorId}_`)
        );
        
        // Aggregate minutes
        const totalMinutes = facilitatorUsage.reduce((sum, record) => 
            sum + record.duration, 0
        );
        
        return {
            facilitatorId,
            totalMinutes,
            sessions: facilitatorUsage,
            startTs,
            endTs
        };
    }
}

module.exports = new AgoraUsageService();
Cron Job for Daily Sync
javascript
// jobs/syncAgoraUsage.js
const cron = require('node-cron');
const agoraUsageService = require('../services/agoraUsageService');
const billingService = require('../services/billingService');

// Run daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
    console.log('Starting Agora usage sync...');
    
    // Get yesterday's timestamps
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const startTs = Math.floor(yesterday.getTime() / 1000);
    const endTs = startTs + 86400;
    
    try {
        // Get all active facilitators
        const facilitators = await db.facilitators.find({ status: 'active' });
        
        for (const facilitator of facilitators) {
            const usage = await agoraUsageService.getUsageForFacilitator(
                facilitator.id,
                startTs,
                endTs
            );
            
            if (usage.totalMinutes > 0) {
                // Calculate cost based on pricing tier
                const rate = facilitator.pricing_tier === 'premium' ? 0.004 : 0.003;
                const cost = usage.totalMinutes * rate;
                
                // Send to Lago for deduction
                await billingService.deductFromWallet(facilitator.id, cost);
                
                // Save usage record
                await db.usage_records.create({
                    facilitator_id: facilitator.id,
                    minutes_used: usage.totalMinutes,
                    billed_to_customer: cost,
                    rate_per_minute: rate,
                    synced_at: new Date()
                });
            }
        }
        
        console.log('Usage sync completed');
    } catch (error) {
        console.error('Usage sync failed:', error);
    }
});
Recording (Optional)
Start Cloud Recording
javascript
async function startRecording(channelName, uid) {
    const url = 'https://api.agora.io/v1/apps/${appId}/cloud_recording/acquire';
    
    const response = await axios.post(url, {
        cname: channelName,
        uid: uid.toString(),
        clientRequest: {}
    }, {
        headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
        }
    });
    
    return response.data;
}
Best Practices
Token Security: Never expose App Certificate to client

Channel Names: Always include facilitator ID for attribution

Error Handling: Implement retry logic for API calls (3 retries with exponential backoff)

Rate Limits: Respect Agora's API limits (10 requests/minute for Premium plan)

Data Delay: Account for 12-hour delay in usage data

Troubleshooting
Issue	Solution
Token invalid	Check App ID/Certificate match
No usage data	Wait 12 hours after calls
401 Unauthorized	Regenerate API credentials
429 Too Many Requests	Implement rate limiting
text

---

## 📄 File 6: `05_LAGO_BILLING_SETUP.md`

```markdown
# Lago Billing Setup Complete Guide

## What is Lago?
Lago is an open-source usage-based billing platform that handles:
- Wallet/pre-paid credit management
- Usage aggregation
- Invoice generation
- Payment gateway integration (Stripe, Adyen)

## Setup Options

### Option A: Lago Cloud (Recommended to start)
- URL: https://app.getlago.com
- Pricing: Based on usage (approx $99-499/month)
- Pros: No infrastructure to manage

### Option B: Self-hosted (Free but more work)
- GitHub: https://github.com/getlago/lago
- Deployment: Docker, AWS, GCP, Azure
- Pros: Full control, no per-seat fees

## Step-by-Step Lago Setup

### 1. Create Lago Account
```bash
# For Lago Cloud
1. Go to https://app.getlago.com/signup
2. Sign up with email
3. Verify your email
4. Get your API Key from Settings → API
2. Create Billable Metric
bash
# Billable metric tracks what you're charging for (video minutes)
curl -X POST https://api.getlago.com/api/v1/billable_metrics \
  -H "Authorization: Bearer YOUR_LAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "billable_metric": {
      "name": "Agora Video Minutes",
      "code": "agora_minutes",
      "description": "Minutes of video/voice calls",
      "aggregation_type": "sum",
      "field_name": "amount"
    }
  }'
3. Create Pricing Plan
bash
# Plan defines how much to charge per minute
curl -X POST https://api.getlago.com/api/v1/plans \
  -H "Authorization: Bearer YOUR_LAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "name": "Standard Tier",
      "code": "standard_tier",
      "interval": "monthly",
      "amount_cents": 0,
      "amount_currency": "USD",
      "bill_charges_monthly": true,
      "charges": [
        {
          "billable_metric_code": "agora_minutes",
          "charge_model": "standard",
          "properties": {
            "amount": "0.003"
          }
        }
      ]
    }
  }'
4. Create Wallet System (Pre-paid Credits)
bash
# Wallet stores facilitator's pre-paid credits
curl -X POST https://api.getlago.com/api/v1/wallets \
  -H "Authorization: Bearer YOUR_LAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": {
      "external_customer_id": "facilitator_101",
      "currency": "USD",
      "rate_amount": "1.00",
      "name": "Agora Credits Wallet",
      "paid_credits": "100.00",
      "granted_credits": "0.00",
      "expiration_at": null,
      "recurring_transaction_rules": [
        {
          "rule_type": "threshold",
          "threshold_credits": "10.00",
          "paid_credits": "50.00"
        }
      ]
    }
  }'
5. Connect Stripe
bash
# In Lago Dashboard:
1. Go to Settings → Payment Gateways
2. Click "Connect Stripe"
3. Enter Stripe API keys
4. Enable "Automatic Payment Collection"
6. Send Usage Events
javascript
// lagoService.js
const axios = require('axios');

class LagoService {
    constructor() {
        this.apiUrl = process.env.LAGO_API_URL;
        this.apiKey = process.env.LAGO_API_KEY;
    }

    async deductMinutes(facilitatorId, minutesUsed, ratePerMinute = 0.003) {
        const cost = minutesUsed * ratePerMinute;
        
        const event = {
            event: {
                external_customer_id: facilitatorId,
                code: "agora_minutes",
                transaction_id: `${facilitatorId}_${Date.now()}`,
                properties: {
                    amount: minutesUsed.toString()
                },
                timestamp: Math.floor(Date.now() / 1000)
            }
        };
        
        const response = await axios.post(
            `${this.apiUrl}/api/v1/events`,
            event,
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            deducted: cost,
            status: response.status === 200 ? 'success' : 'failed'
        };
    }

    async getWalletBalance(facilitatorId) {
        const response = await axios.get(
            `${this.apiUrl}/api/v1/wallets/${facilitatorId}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            }
        );
        
        return {
            balance: response.data.wallet.balance_cents / 100,
            currency: response.data.wallet.currency,
            last_updated: response.data.wallet.updated_at
        };
    }

    async topUpWallet(facilitatorId, amount, stripePaymentIntentId) {
        const topup = {
            wallet_transaction: {
                wallet_id: facilitatorId,
                transaction_type: "inbound",
                amount: amount.toString(),
                status: "pending",
                metadata: {
                    stripe_payment_intent_id: stripePaymentIntentId
                }
            }
        };
        
        const response = await axios.post(
            `${this.apiUrl}/api/v1/wallets/${facilitatorId}/top_up`,
            topup,
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data;
    }
}

module.exports = new LagoService();
7. Real-time Balance Check
javascript
// middleware/checkBalance.js
async function checkBalance(req, res, next) {
    const facilitatorId = req.user.facilitatorId;
    
    // Get current balance
    const wallet = await lagoService.getWalletBalance(facilitatorId);
    
    // Minimum $5 required to start a session
    if (wallet.balance < 5) {
        return res.status(402).json({
            error: 'Insufficient balance',
            message: `Your wallet balance is $${wallet.balance}. Minimum $5 required to start a session.`,
            current_balance: wallet.balance,
            topup_url: '/api/wallet/topup'
        });
    }
    
    req.walletBalance = wallet.balance;
    next();
}

// Apply to session creation endpoint
app.post('/sessions/create', checkBalance, sessionController.create);
8. Webhook Handling (Stripe → Lago)
javascript
// webhooks/stripe.js
app.post('/webhooks/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const facilitatorId = session.client_reference_id;
        const amount = session.amount_total / 100;
        
        // Tell Lago to add credits to wallet
        await lagoService.topUpWallet(facilitatorId, amount, session.id);
        
        // Record in your database
        await db.wallet_transactions.create({
            facilitator_id: facilitatorId,
            lago_transaction_id: session.id,
            transaction_type: 'topup',
            amount: amount,
            status: 'completed'
        });
    }
    
    res.json({ received: true });
});
Wallet Configuration Options
Auto Top-up (Prevent Service Interruption)
json
{
    "recurring_transaction_rules": [
        {
            "rule_type": "threshold",
            "threshold_credits": "10.00",  // Trigger when below $10
            "paid_credits": "50.00"        // Auto-add $50
        },
        {
            "rule_type": "interval",
            "interval": "monthly",          // Monthly top-up
            "paid_credits": "100.00"        // Add $100 each month
        }
    ]
}
Wallet Expiration
json
{
    "expiration_at": "2025-12-31T23:59:59Z",  // Credits expire
    "expiration_credits": "100.00"             // Refund unused amount
}
Testing Lago Integration
Simulate Usage Deduction
javascript
// test/lago.test.js
const lagoService = require('../services/lagoService');

async function testDeduction() {
    // Add test credits first
    await lagoService.topUpWallet('test_facilitator', 100, 'test_payment');
    
    // Get initial balance
    const initial = await lagoService.getWalletBalance('test_facilitator');
    console.log('Initial balance:', initial.balance);
    
    // Deduct 10,000 minutes ($30)
    await lagoService.deductMinutes('test_facilitator', 10000, 0.003);
    
    // Get new balance
    const final = await lagoService.getWalletBalance('test_facilitator');
    console.log('Final balance:', final.balance);
    console.log('Deducted:', initial.balance - final.balance);
}

testDeduction();
Monitoring & Alerts
javascript
// jobs/monitorBalances.js
async function checkLowBalances() {
    const facilitators = await db.facilitators.find({ status: 'active' });
    
    for (const facilitator of facilitators) {
        const wallet = await lagoService.getWalletBalance(facilitator.id);
        
        if (wallet.balance < 10) {
            // Send email alert
            await emailService.send({
                to: facilitator.email,
                subject: 'Low Wallet Balance',
                body: `Your wallet balance is $${wallet.balance}. Please top up to avoid service interruption.`
            });
        }
        
        if (wallet.balance < 5) {
            // Log warning
            console.warn(`Critical low balance for ${facilitator.email}: $${wallet.balance}`);
        }
    }
}

// Run every hour
cron.schedule('0 * * * *', checkLowBalances);
Troubleshooting
Issue	Solution
Wallet not found	Create wallet before first top-up
Deduction fails	Check billable metric code matches
Stripe not connecting	Verify API keys in Lago settings
Balance not updating	Check event timestamp (must be within last 30 days)
text

---

## 📄 File 7: `06_FRONTEND_GUIDE.md`

```markdown
# Frontend Integration Guide

## Technology Stack
- **Framework**: React 18+ or Vue 3+
- **Agora SDK**: agora-rtc-sdk-ng
- **WebSocket**: Socket.IO client
- **Styling**: Tailwind CSS / Material-UI

## Quick Start (React)

### 1. Install Dependencies
```bash
npm install agora-rtc-sdk-ng socket.io-client axios
2. Agora Client Setup
javascript
// hooks/useAgora.js
import { useEffect, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

export const useAgora = () => {
    const [client, setClient] = useState(null);
    const [localAudioTrack, setLocalAudioTrack] = useState(null);
    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState([]);

    useEffect(() => {
        const rtcClient = AgoraRTC.createClient({ 
            mode: 'rtc', 
            codec: 'h264' 
        });
        setClient(rtcClient);
        
        return () => {
            localAudioTrack?.close();
            localVideoTrack?.close();
            rtcClient?.leave();
        };
    }, []);

    const joinChannel = async (channelName, token, uid) => {
        if (!client) return;
        
        await client.join(process.env.REACT_APP_AGORA_APP_ID, channelName, token, uid);
        
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);
        
        await client.publish([audioTrack, videoTrack]);
        
        client.on('user-published', async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            
            if (mediaType === 'video') {
                setRemoteUsers(prev => [...prev, user]);
            }
        });
        
        client.on('user-unpublished', (user) => {
            setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });
    };

    const leaveChannel = async () => {
        localAudioTrack?.close();
        localVideoTrack?.close();
        await client?.leave();
        setRemoteUsers([]);
    };

    return { joinChannel, leaveChannel, localVideoTrack, remoteUsers };
};
3. Chat Component (WebSocket)
javascript
// components/Chat.jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const Chat = ({ sessionId, userId, userName }) => {
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        const newSocket = io(process.env.REACT_APP_WS_URL, {
            query: { sessionId, userId, token: localStorage.getItem('token') }
        });
        
        newSocket.on('message', (message) => {
            setMessages(prev => [...prev, message]);
        });
        
        newSocket.on('history', (history) => {
            setMessages(history);
        });
        
        setSocket(newSocket);
        
        return () => newSocket.close();
    }, [sessionId, userId]);

    const sendMessage = () => {
        if (!input.trim()) return;
        socket.emit('message', {
            sessionId,
            userId,
            userName,
            content: input,
            type: 'text'
        });
        setInput('');
    };

    return (
        <div className="chat-container">
            <div className="messages">
                {messages.map(msg => (
                    <div key={msg.id} className="message">
                        <strong>{msg.userName}:</strong> {msg.content}
                    </div>
                ))}
            </div>
            <div className="input-area">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                />
                <button onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
};
4. Wallet Top-up Component
javascript
// components/WalletTopup.jsx
import { useState } from 'react';
import axios from 'axios';

const WalletTopup = ({ facilitatorId, onTopupComplete }) => {
    const [amount, setAmount] = useState(100);
    const [loading, setLoading] = useState(false);

    const handleTopup = async () => {
        setLoading(true);
        try {
            const response = await axios.post('/api/wallet/topup', {
                amount,
                success_url: window.location.href + '?success=true',
                cancel_url: window.location.href + '?canceled=true'
            });
            
            // Redirect to Stripe Checkout
            window.location.href = response.data.checkout_url;
        } catch (error) {
            console.error('Topup failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wallet-card">
            <h3>Wallet Balance: ${balance}</h3>
            <div className="topup-controls">
                <select value={amount} onChange={(e) => setAmount(e.target.value)}>
                    <option value={25}>$25</option>
                    <option value={50}>$50</option>
                    <option value={100}>$100</option>
                    <option value={250}>$250</option>
                    <option value={500}>$500</option>
                </select>
                <button onClick={handleTopup} disabled={loading}>
                    {loading ? 'Processing...' : 'Add Funds'}
                </button>
            </div>
        </div>
    );
};
5. Complete Video Room Component
javascript
// components/VideoRoom.jsx
import { useEffect, useState } from 'react';
import { useAgora } from '../hooks/useAgora';
import Chat from './Chat';
import axios from 'axios';

const VideoRoom = ({ sessionId, facilitatorId, userId, userName }) => {
    const [agoraToken, setAgoraToken] = useState(null);
    const [channelName, setChannelName] = useState(null);
    const { joinChannel, leaveChannel, localVideoTrack, remoteUsers } = useAgora();

    useEffect(() => {
        // Get session details from your backend
        const initSession = async () => {
            const response = await axios.get(`/api/sessions/${sessionId}/token`);
            setAgoraToken(response.data.agora_token);
            setChannelName(response.data.channel_name);
        };
        initSession();

        return () => {
            leaveChannel();
        };
    }, [sessionId]);

    useEffect(() => {
        if (agoraToken && channelName) {
            joinChannel(channelName, agoraToken, userId);
        }
    }, [agoraToken, channelName]);

    return (
        <div className="video-room">
            <div className="video-grid">
                {/* Local video */}
                <div className="video-tile">
                    <video ref={ref => ref && localVideoTrack?.play(ref)} />
                    <span>You</span>
                </div>
                
                {/* Remote videos (max 50 visible) */}
                {remoteUsers.map(user => (
                    <div key={user.uid} className="video-tile">
                        <video ref={ref => ref && user.videoTrack?.play(ref)} />
                        <span>User {user.uid}</span>
                    </div>
                ))}
            </div>
            
            <div className="controls">
                <button onClick={() => localVideoTrack?.setEnabled(!localVideoTrack.enabled)}>
                    Toggle Video
                </button>
                <button onClick={() => localAudioTrack?.setEnabled(!localAudioTrack.enabled)}>
                    Mute
                </button>
                <button onClick={leaveChannel}>Leave</button>
            </div>
            
            <Chat sessionId={sessionId} userId={userId} userName={userName} />
        </div>
    );
};
Responsive Design for 300 Participants
css
/* video-grid.css */
.video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    height: 100vh;
    overflow-y: auto;
}

/* For 50+ active videos, show scrollable grid */
.video-grid.active-speakers {
    grid-template-columns: repeat(5, 1fr);
}

/* Audience view - only show hosts */
.audience-view {
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Raise hand indicator */
.raised-hand {
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
}
Performance Optimizations
javascript
// Only render visible videos
import { useVirtualizer } from '@tanstack/react-virtual';

const VideoGrid = ({ videos }) => {
    const parentRef = useRef();
    const rowVirtualizer = useVirtualizer({
        count: videos.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 200,
    });
    
    return (
        <div ref={parentRef}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => (
                <div key={virtualRow.key}>
                    <VideoTile video={videos[virtualRow.index]} />
                </div>
            ))}
        </div>
    );
};
text

---

## 📄 File 8: `07_DEPLOYMENT_CHECKLIST.md`

```markdown
# Deployment Checklist

## Pre-Deployment Verification

### ✅ Agora Configuration
- [ ] App ID and App Certificate created
- [ ] Analytics (水晶球) enabled
- [ ] RESTful API credentials generated
- [ ] Test channel created and verified
- [ ] Cloud recording configured (if needed)

### ✅ Lago Setup
- [ ] Lago Cloud account created OR self-hosted instance deployed
- [ ] Billable metric "agora_minutes" created
- [ ] Pricing plan configured ($0.003/min)
- [ ] Wallet system tested
- [ ] Stripe connected and verified

### ✅ Backend Services
- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ configured
- [ ] Redis 6+ running
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] API endpoints tested with Postman

### ✅ Frontend
- [ ] Agora Web SDK integrated
- [ ] Socket.IO client configured
- [ ] Responsive design tested on mobile/desktop
- [ ] Browser compatibility (Chrome, Firefox, Safari)
- [ ] WebRTC permissions handling

### ✅ Security
- [ ] HTTPS enabled (Let's Encrypt or purchased cert)
- [ ] JWT secret set to strong random value
- [ ] Agora App Certificate not exposed in frontend
- [ ] API rate limiting configured
- [ ] CORS restricted to your domains
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection headers set

### ✅ Monitoring
- [ ] Log aggregation (Datadog/New Relic)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Uptime monitoring (UptimeRobot)
- [ ] Agora Analytics dashboard access

### ✅ Backup & Recovery
- [ ] Automated database backups (daily)
- [ ] Backup retention policy (30 days)
- [ ] Disaster recovery plan documented
- [ ] Rollback procedure tested

## Deployment Steps

### 1. Prepare Production Environment
```bash
# Create production database
createdb agora_platform_prod

# Run migrations
npm run migrate:prod

# Seed initial data
npm run seed:prod
2. Deploy Backend
bash
# Option A: Deploy to AWS Elastic Beanstalk
eb init
eb create agora-platform-prod
eb deploy

# Option B: Deploy to DigitalOcean Droplet
ssh root@your-server
git clone https://github.com/your-repo/agora-platform.git
cd agora-platform
npm install
pm2 start ecosystem.config.js
3. Deploy Frontend
bash
# Build React app
npm run build

# Deploy to Vercel
vercel --prod

# OR deploy to Netlify
netlify deploy --prod

# OR deploy to S3 + CloudFront
aws s3 sync build/ s3://your-bucket/
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
4. Configure Environment Variables (Production)
Create .env.production:

env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/agora_platform_prod

# Redis
REDIS_URL=redis://:password@host:6379

# Agora
AGORA_APP_ID=your_prod_app_id
AGORA_APP_CERTIFICATE=your_prod_certificate
AGORA_CUSTOMER_ID=your_customer_id
AGORA_API_KEY=your_api_key
AGORA_API_SECRET=your_api_secret

# Lago
LAGO_API_URL=https://api.getlago.com
LAGO_API_KEY=your_prod_lago_key

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# JWT
JWT_SECRET=your_very_strong_random_secret

# Email (for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@yourplatform.com
SMTP_PASS=your_password
5. Set Up Cron Jobs
bash
# Add to crontab
crontab -e

# Add these lines:
0 2 * * * cd /path/to/app && node jobs/syncAgoraUsage.js >> logs/usage-sync.log 2>&1
0 * * * * cd /path/to/app && node jobs/monitorBalances.js >> logs/balance-monitor.log 2>&1
0 8 * * * cd /path/to/app && node jobs/dailyReport.js >> logs/daily-report.log 2>&1
6. Configure Webhooks
bash
# Stripe webhook endpoint
https://api.yourplatform.com/webhooks/stripe

# Lago webhook endpoint (if needed)
https://api.yourplatform.com/webhooks/lago
7. Load Testing (Before Launch)
bash
# Install k6
brew install k6

# Run load test
k6 run load-test.js

# Expected results for 300 concurrent users:
# - API response time < 500ms
# - Error rate < 1%
# - CPU usage < 70%
# - Memory usage < 80%
8. Post-Deployment Verification
bash
# Test API health
curl https://api.yourplatform.com/health

# Create test session
curl -X POST https://api.yourplatform.com/sessions/create \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"title": "Test Session"}'

# Check wallet balance
curl https://api.yourplatform.com/wallet/balance \
  -H "Authorization: Bearer $TEST_TOKEN"

# Verify WebSocket connection
wscat -c wss://api.yourplatform.com/chat?session_id=test&token=$TEST_TOKEN
Go/No-Go Criteria
✅ GO if:
All tests pass

Security audit completed

Load test passes with 300 users

Backup system working

Monitoring dashboard shows green

Facilitator onboarding works end-to-end

Payment processing works with test card

❌ NO-GO if:
Agora API returns errors

Lago wallet not deducting

Stripe checkout fails

Database backups not tested

Any security issue found

Response time > 1 second

Launch Day Checklist
Morning of Launch
Final database backup taken

All services restarted

Monitoring dashboard verified

Support team briefed

Rollback plan ready

During Launch (First Hour)
Monitor error rates every 5 minutes

Watch database connection pool

Track Agora usage in real-time

Log all new facilitator signups

Check Stripe payment success rate

After Launch (First Week)
Daily usage sync verification

Weekly backup restore test

Customer support ticket review

Performance optimization based on real data

text

---

## 📄 File 9: `09_IMPLEMENTATION_TIMELINE.md`

```markdown
# Implementation Timeline (12 Weeks)

## Week 1-2: Foundation Setup
**Goal**: Infrastructure and basic authentication

| Day | Tasks |
|-----|-------|
| 1-2 | Set up Agora account, get App ID/Certificate |
| 3-4 | Deploy Lago (Cloud or self-hosted) |
| 5-6 | Connect Stripe to Lago |
| 7-10 | Build user authentication (Node.js + JWT) |
| 11-12 | Set up PostgreSQL database, run migrations |
| 13-14 | Deploy to staging environment |

**Deliverables**:
- Working authentication API
- Database with facilitator table
- Staging environment accessible

## Week 3-5: Core Video Features
**Goal**: Agora integration working

| Day | Tasks |
|-----|-------|
| 15-17 | Implement Agora token generation (server-side) |
| 18-20 | Build session creation API |
| 21-23 | Create basic video room frontend component |
| 24-26 | Test 1:1 video calls |
| 27-30 | Implement group calls (5-10 people) |
| 31-35 | Test with 50 participants (SFU mode) |

**Deliverables**:
- Working video call with 50 participants
- Session management API
- Basic frontend video UI

## Week 6-8: Billing & Wallet Integration
**Goal**: Lago wallet system working

| Day | Tasks |
|-----|-------|
| 36-38 | Create Lago billable metric and plan |
| 39-41 | Build wallet top-up API with Stripe |
| 42-44 | Implement usage sync cron job |
| 45-47 | Add balance check middleware |
| 48-50 | Test end-to-end deduction flow |
| 51-56 | Build facilitator wallet dashboard UI |

**Deliverables**:
- Working wallet system
- Auto-deduction from pre-paid credits
- Wallet UI with top-up button

## Week 9-10: Chat & Polish
**Goal**: Real-time chat and polish

| Day | Tasks |
|-----|-------|
| 57-59 | Implement WebSocket chat server |
| 60-62 | Build chat frontend component |
| 63-64 | Add message persistence (PostgreSQL) |
| 65-67 | Implement raise hand feature for 300 users |
| 68-70 | Add participant list and moderation controls |
| 71-72 | UI polish and responsive design |

**Deliverables**:
- Working real-time chat
- 300-participant support (50 active, 250 audience)
- Moderator controls

## Week 11-12: Testing & Deployment
**Goal**: Production ready

| Day | Tasks |
|-----|-------|
| 73-75 | Load testing with 300 simulated users |
| 76-78 | Security audit (penetration testing) |
| 79-81 | Documentation (user guides, API docs) |
| 82-84 | Deploy to production |
| 85-87 | Beta test with 3 facilitators |
| 88-90 | Fix bugs, optimize performance |
| 91-94 | Final launch preparation |

**Deliverables**:
- Production deployment
- Load test results (300 users)
- Monitoring dashboard
- Rollback plan

## Critical Path Dependencies
Week 1-2: Auth + Database
↓
Week 3-5: Video Calls (depends on Auth)
↓
Week 6-8: Billing (depends on Video + Auth)
↓
Week 9-10: Chat (depends on Sessions)
↓
Week 11-12: Testing + Launch

text

## Resource Allocation

| Role | Weeks | Effort |
|------|-------|--------|
| Backend Developer (1) | 1-12 | Full-time |
| Frontend Developer (1) | 3-10 | Full-time |
| DevOps Engineer (0.5) | 1, 11-12 | Part-time |
| QA Tester (0.5) | 9-12 | Part-time |

## Success Metrics at Launch

| Metric | Target |
|--------|--------|
| Concurrent users | 300 |
| API response time | < 500ms |
| Video latency | < 400ms |
| Chat message delay | < 100ms |
| Wallet deduction accuracy | 100% |
| Uptime | 99.9% |
| Facilitator onboarding time | < 5 minutes |

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Agora API downtime | Low | High | Have backup TURN server |
| Lago billing errors | Medium | High | Manual reconciliation script |
| Stripe payment failures | Medium | Medium | Retry logic + manual top-up |
| Database corruption | Low | Critical | Daily backups + read replicas |
| WebRTC compatibility | Medium | Medium | Test on all browsers |
