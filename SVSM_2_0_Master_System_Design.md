# SVSM 2.0 — Master System Design & Implementation Specification

**Product:** SVSM 2.0  
**Working meaning:** Streaming Video Session Manager / Community & Live Experience Platform  
**Document status:** Proposed master architecture  
**Supersedes:** SVSM Platform Documentation 1.0  
**Primary goal:** Evolve SVSM from a white-label video-session + prepaid usage platform into a community, live-event, paid-seat, creator/host monetization and marketplace platform.

---

## 1. Executive Summary

SVSM 1.0 already provides the technical foundation for authenticated video sessions, Agora RTC, session management, chat, prepaid billing, Lago usage metering, Stripe Checkout, PostgreSQL, Redis/Docker/Nginx, and an administrative layer.

SVSM 2.0 keeps that foundation but changes the product model.

### SVSM 2.0 product definition

> SVSM is a platform where people discover communities, join live experiences, attend paid events, communicate with members, and where hosts can build and monetize communities.

The live video room is no longer the whole product. It becomes the **Live Experience Engine** inside a larger ecosystem.

### Core product pillars

1. Identity and profiles
2. Communities
3. Events and scheduling
4. Paid seats/tickets
5. Live video and audio
6. Chat and interaction
7. Memberships and subscriptions
8. Host monetization and payouts
9. Discovery and marketplace
10. Moderation and trust
11. Notifications
12. Analytics
13. Administration
14. Video usage metering and infrastructure billing
15. Security, observability and scale

---

# 2. Design Principles

## 2.1 Build on SVSM 1.0

Do not throw away the existing video infrastructure.

Keep and improve:

- React + TypeScript
- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- Agora RTC
- Lago metering
- Stripe integration
- Redis
- Docker/Nginx
- session lifecycle
- chat foundation
- usage records
- administrative concepts

## 2.2 Separate marketplace money from infrastructure billing

There are two financial systems:

### A. Marketplace money

Participant pays for:

- ticket
- seat
- membership
- subscription
- premium access

Stripe/Stripe Connect handles the payment and host/platform fund flow.

### B. Infrastructure cost

SVSM incurs costs for:

- video minutes
- recording
- storage
- other infrastructure

Lago remains the metering/billing engine for infrastructure consumption.

These ledgers must not be mixed.

## 2.3 Access is entitlement-driven

A valid login is not enough to enter a paid event.

The backend must evaluate:

- user identity
- event status
- ticket/seat
- payment status
- membership
- invitation
- host/moderator role
- suspension status
- event capacity

Only then should the backend issue the appropriate Agora token.

## 2.4 Server is authoritative

Never trust:

- client-side payment success
- client-side seat count
- client-side host role
- client-side price
- client-side event ownership
- client-side attendance
- client-side payout amount

The backend owns these decisions.

---

# 3. Product Roles

A single account can have multiple roles.

## 3.1 User

Every account can:

- create a profile
- discover communities
- follow hosts
- join free communities
- purchase tickets
- join events
- participate in chat
- review events
- report content
- block users

## 3.2 Host

A user may become a host and:

- create communities
- create events
- sell seats
- create membership plans
- manage members
- host live sessions
- invite co-hosts/moderators
- publish resources
- view analytics
- receive payouts

## 3.3 Community Owner

Owns a community and controls:

- community settings
- membership rules
- moderators
- events
- announcements
- resources
- monetization

## 3.4 Moderator

Can:

- remove messages
- mute participants
- remove participants
- ban users
- review reports
- enforce community rules

## 3.5 Co-host

Can assist with a live event:

- join as presenter
- moderate
- manage participants
- share screen
- control selected event features

## 3.6 Platform Admin

Can manage the whole SVSM ecosystem:

- users
- hosts
- communities
- events
- payments
- payouts
- refunds
- reports
- verification
- moderation
- platform fees
- analytics
- system settings

---

# 4. High-Level Architecture

```text
                         ┌───────────────────────┐
                         │      Web / Mobile     │
                         │       Clients         │
                         └───────────┬───────────┘
                                     │
                              HTTPS / WebSocket
                                     │
                         ┌───────────▼───────────┐
                         │       NGINX / CDN     │
                         └───────────┬───────────┘
                                     │
                         ┌───────────▼───────────┐
                         │       API Gateway     │
                         │   Node.js / Express   │
                         └───────────┬───────────┘
                                     │
       ┌─────────────────────────────┼──────────────────────────────┐
       │                             │                              │
       ▼                             ▼                              ▼
 Auth & Identity              Community/Event              Commerce
 Service                      Service                       Service
       │                             │                              │
       └─────────────────────────────┼──────────────────────────────┘
                                     │
       ┌─────────────────────────────┼──────────────────────────────┐
       │                             │                              │
       ▼                             ▼                              ▼
 Live/Room Service             Chat/Realtime               Notification
       │                             │                       Service
       │                             │
       ▼                             ▼
 Agora RTC                    Redis / WebSocket
       │
       ▼
 Recording / Media

                ┌────────────────────────────────────┐
                │             PostgreSQL              │
                │ Users / Communities / Events /     │
                │ Tickets / Payments / Memberships / │
                │ Payouts / Moderation / Analytics   │
                └────────────────────────────────────┘

 External:
 ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
 │ Stripe Connect│ │ Lago         │ │ Object Store │
 │ Payments      │ │ Metering     │ │ S3-compatible│
 └───────────────┘ └──────────────┘ └──────────────┘
```

---

# 5. Technology Stack

## Frontend

- React 19+
- TypeScript
- Vite initially
- React Router
- TanStack Query
- WebSocket/Socket.IO client
- Agora React SDK
- responsive CSS/design system
- accessibility support

The existing custom state-machine router should be replaced by a proper route structure as the application grows.

## Backend

- Node.js 20+ LTS
- Express 5+
- TypeScript
- Prisma
- PostgreSQL
- Zod validation
- JWT access/refresh authentication
- Redis
- WebSocket/Socket.IO
- background jobs
- structured logging

## Video

- Agora RTC as the initial media provider
- server-generated tokens
- token refresh
- role-specific RTC permissions
- recording integration
- participant events/webhooks where available

## Payments

- Stripe
- Stripe Connect for host/marketplace payouts
- Stripe Checkout
- Stripe webhooks
- Stripe Customer/connected-account data
- refund support
- payout status synchronization

## Metering

- Lago for infrastructure usage
- usage records stored in SVSM
- reconciliation jobs

## Infrastructure

- Docker
- Nginx
- PostgreSQL
- Redis
- object storage
- queue/background worker
- CI/CD
- monitoring/log aggregation

---

# 6. Domain Model

The new domain model is centered on users, communities and events.

```text
User
 ├── Profile
 ├── HostAccount
 ├── Communities owned
 ├── Community memberships
 ├── Events created
 ├── Event tickets
 ├── Payments
 ├── Payouts
 ├── Reviews
 └── Reports

Community
 ├── Owner
 ├── Members
 ├── Moderators
 ├── Membership Plans
 ├── Events
 ├── Posts/Discussions
 ├── Resources
 └── Announcements

Event
 ├── Community
 ├── Host
 ├── Tickets/Seats
 ├── Attendees
 ├── Meeting
 ├── Chat
 ├── Recording
 ├── Reviews
 └── Usage Records
```

---

# 7. Database Design

PostgreSQL remains the primary database.

## 7.1 users

```text
id UUID PK
email UNIQUE
password_hash
status
email_verified
last_login_at
created_at
updated_at
```

## 7.2 profiles

```text
id UUID PK
user_id FK UNIQUE
display_name
username UNIQUE
bio
avatar_url
location
website_url
created_at
updated_at
```

## 7.3 roles

```text
id UUID PK
name
description
```

Global roles should include:

- user
- host
- moderator
- admin
- super_admin

Community/event roles should be scoped separately.

## 7.4 communities

```text
id UUID PK
owner_id FK
name
slug UNIQUE
description
cover_image_url
avatar_url
visibility
access_type
status
created_at
updated_at
```

Visibility:

- public
- private
- unlisted

Access:

- free
- paid
- subscription
- invite_only

## 7.5 community_members

```text
id UUID PK
community_id FK
user_id FK
role
status
joined_at
left_at
```

Roles:

- member
- moderator
- admin
- owner

## 7.6 membership_plans

```text
id UUID PK
community_id FK
name
description
price
currency
billing_interval
stripe_price_id
status
created_at
updated_at
```

Billing intervals:

- monthly
- yearly
- one_time

## 7.7 subscriptions

```text
id UUID PK
user_id FK
community_id FK
membership_plan_id FK
stripe_subscription_id
status
current_period_start
current_period_end
cancel_at_period_end
created_at
updated_at
```

## 7.8 events

```text
id UUID PK
community_id FK nullable
host_id FK
title
slug
description
event_type
visibility
access_type
scheduled_start
scheduled_end
timezone
capacity
price
currency
status
recording_enabled
created_at
updated_at
```

Event types:

- meeting
- workshop
- class
- webinar
- networking
- community_meetup
- panel
- consultation
- livestream

## 7.9 event_tickets

```text
id UUID PK
event_id FK
name
description
price
currency
capacity
sold_count
benefits_json
stripe_price_id
status
created_at
updated_at
```

This enables:

- Standard
- Premium
- VIP
- custom ticket tiers

## 7.10 event_attendees

```text
id UUID PK
event_id FK
user_id FK
ticket_id FK
payment_id FK
status
checked_in_at
joined_at
left_at
created_at
```

Status:

- reserved
- paid
- cancelled
- refunded
- attended
- no_show

## 7.11 meetings

```text
id UUID PK
event_id FK UNIQUE
channel_name UNIQUE
status
started_at
ended_at
participant_count
recording_status
recording_url
created_at
updated_at
```

## 7.12 meeting_participants

```text
id UUID PK
meeting_id FK
user_id FK
rtc_uid
role
joined_at
left_at
duration_seconds
```

## 7.13 payments

```text
id UUID PK
user_id FK
event_id FK nullable
community_id FK nullable
amount
currency
stripe_payment_intent_id
stripe_checkout_session_id
status
payment_type
created_at
updated_at
```

Payment types:

- event_ticket
- membership
- subscription
- donation
- other

## 7.14 platform_fees

```text
id UUID PK
payment_id FK
percentage
fixed_amount
fee_amount
currency
created_at
```

## 7.15 host_earnings

```text
id UUID PK
host_id FK
payment_id FK
gross_amount
platform_fee
stripe_fee_estimate
net_amount
currency
status
created_at
```

## 7.16 payouts

```text
id UUID PK
host_id FK
stripe_connected_account_id
amount
currency
stripe_transfer_id
stripe_payout_id
status
created_at
completed_at
```

## 7.17 refunds

```text
id UUID PK
payment_id FK
amount
reason
stripe_refund_id
status
created_at
```

## 7.18 community_posts

```text
id UUID PK
community_id FK
author_id FK
title
content
status
created_at
updated_at
```

## 7.19 comments

```text
id UUID PK
post_id FK
author_id FK
content
status
created_at
updated_at
```

## 7.20 messages

```text
id UUID PK
conversation_scope
community_id FK nullable
meeting_id FK nullable
sender_id FK
message_type
content
file_url
created_at
deleted_at
```

## 7.21 notifications

```text
id UUID PK
user_id FK
type
title
body
data_json
read_at
created_at
```

## 7.22 reviews

```text
id UUID PK
event_id FK
user_id FK
rating
comment
status
created_at
```

## 7.23 reports

```text
id UUID PK
reporter_id FK
target_type
target_id
reason
description
status
reviewed_by
reviewed_at
created_at
```

## 7.24 moderation_actions

```text
id UUID PK
moderator_id FK
target_user_id FK nullable
community_id FK nullable
event_id FK nullable
action
reason
expires_at
created_at
```

## 7.25 usage_records

Retain and expand the existing model:

```text
id UUID PK
event_id FK
meeting_id FK
host_id FK
minutes_used
cost_to_platform
billed_internal_cost
rate_per_minute
sync_status
sync_attempts
lago_transaction_id
synced_at
created_at
```

## 7.26 audit_logs

```text
id BIGSERIAL PK
actor_id FK nullable
action
entity_type
entity_id
metadata JSONB
ip_address
user_agent
created_at
```

---

# 8. Payment Architecture

## 8.1 Participant payment flow

```text
User selects event
       ↓
Selects ticket
       ↓
Backend validates:
  - event active
  - ticket active
  - seat available
  - user eligible
       ↓
Create pending order/payment
       ↓
Create Stripe Checkout Session
       ↓
User pays
       ↓
Stripe webhook
       ↓
Verify webhook signature
       ↓
Mark payment successful
       ↓
Reserve/confirm seat
       ↓
Create attendee entitlement
       ↓
Calculate platform fee
       ↓
Record host earning
       ↓
User receives access
```

The redirect page is not the source of truth. The webhook is.

## 8.2 Revenue split

Example:

```text
Ticket price = $10

Platform commission = 20%
Platform gross fee = $2

Host gross share = $8
```

The exact fee percentage must be configurable.

Possible configuration:

```text
standard = 20%
verified_host = 15%
enterprise = custom
```

The final settlement must account for applicable Stripe/payment costs and the platform's selected fund-flow model.

## 8.3 Host onboarding

Host selects:

> Become a host

Backend creates/onboards the connected Stripe account.

Host completes required identity/business information with Stripe.

SVSM stores:

```text
stripe_connected_account_id
onboarding_status
charges_enabled
payouts_enabled
```

A host must not be allowed to sell paid events until required payout capabilities are enabled.

## 8.4 Refund flow

```text
Admin/eligible host initiates refund
        ↓
Validate payment/refund policy
        ↓
Stripe refund
        ↓
Webhook confirmation
        ↓
Ticket status = refunded
        ↓
Seat becomes available where appropriate
        ↓
Host earning adjusted
        ↓
Ledger/audit record created
```

Refunds must be idempotent.

---

# 9. Paid Seat System

Every paid event has an explicit inventory.

Example:

```text
Event capacity: 50

Standard: 35 seats × $5
Premium: 10 seats × $10
VIP: 5 seats × $25
```

The database, not the frontend, determines availability.

Seat reservation should use a transaction/locking strategy so two users cannot purchase the final seat simultaneously.

Recommended state machine:

```text
AVAILABLE
   ↓
HELD
   ↓
PAID
   ↓
CHECKED_IN
   ↓
ATTENDED
```

Failure:

```text
HELD → EXPIRED
PAID → REFUNDED
```

A temporary hold should expire automatically if payment is not completed.

---

# 10. Community System

A community is a persistent space around a topic, host, organization or interest.

## Community home

```text
Community header
 ├── About
 ├── Members
 ├── Discussions
 ├── Events
 ├── Live now
 ├── Resources
 └── Membership
```

## Community controls

Owner can:

- edit community
- change visibility
- manage members
- appoint moderators
- create events
- create membership plans
- publish announcements
- remove posts
- suspend members

## Community discovery

Users can search by:

- topic
- category
- host
- location
- language
- price
- event date
- popularity

---

# 11. Event System

Event creation:

```text
Title
Description
Category
Community
Date
Timezone
Duration
Capacity
Ticket types
Access type
Recording
Chat
Moderation settings
```

Access types:

- free
- paid_ticket
- community_member
- subscription_member
- invite_only

## Event lifecycle

```text
DRAFT
 ↓
PUBLISHED
 ↓
SCHEDULED
 ↓
LIVE
 ↓
ENDED
 ↓
ARCHIVED
```

Alternative terminal states:

- CANCELLED
- SUSPENDED

---

# 12. Live Room

The existing Agora architecture remains the media layer.

## Token issuance

Before joining:

```text
JWT valid?
Event exists?
Event live/scheduled?
User entitled?
Ticket paid?
Seat valid?
User banned?
Role allowed?
        ↓
Generate Agora token
```

## RTC roles

Do not give every participant publisher permissions.

Use role-specific access:

- host: publisher
- co-host: publisher
- presenter: publisher
- audience: subscriber where the event format allows it
- moderator: permissions appropriate to the event design

## Token refresh

Tokens currently expire after one hour in the existing implementation. SVSM 2.0 must implement refresh before expiration.

## Live controls

Host:

- mute participant
- remove participant
- disable participant camera
- promote to presenter
- demote presenter
- lock room
- end event
- enable/disable chat
- start/stop recording
- screen share

Audience:

- camera/mic according to ticket/event permissions
- chat
- raise hand
- reactions
- polls
- Q&A

---

# 13. Chat and Interaction

Chat must work in both:

### Event chat

Temporary or persistent around a live event.

### Community chat/discussions

Persistent after the event ends.

Features:

- text
- reactions
- system messages
- moderation
- delete
- report
- rate limiting
- mentions
- optional file/image attachments

## Real-time architecture

```text
Client
 ↓
WebSocket gateway
 ↓
Redis pub/sub
 ↓
Connected instances
```

Persist important messages to PostgreSQL.

---

# 14. Engagement Features

SVSM 2.0 should support:

- raise hand
- reactions
- polls
- Q&A
- attendee list
- speaker list
- breakout/networking areas as a later capability
- event announcements
- pinned messages
- post-event discussion

---

# 15. Membership System

Communities can have:

### Free membership

No recurring payment.

### Paid membership

Example:

```text
Basic      $5/month
Pro       $15/month
VIP       $30/month
```

Each plan can define:

- community access
- event discounts
- exclusive events
- premium resources
- recordings
- special chat rooms
- priority Q&A

Membership status must control entitlements.

---

# 16. Host Dashboard

The host dashboard becomes the business center.

## Overview

```text
Members
Followers
Upcoming events
Tickets sold
Gross revenue
Platform fees
Net earnings
Pending payouts
Attendance
```

## Community management

- communities
- members
- moderators
- posts
- resources

## Event management

- create
- edit
- schedule
- ticket tiers
- attendees
- check-in
- recordings
- analytics

## Financial dashboard

```text
Gross sales
Platform fees
Refunds
Net earnings
Available balance
Pending balance
Payout history
```

---

# 17. Analytics

## Host analytics

Track:

- event views
- conversion rate
- tickets sold
- attendance rate
- no-show rate
- repeat attendees
- revenue
- average ticket price
- community growth
- member retention

## Platform analytics

Admin sees:

- registered users
- active users
- active communities
- events created
- events completed
- gross payment volume
- platform revenue
- host payouts
- refunds
- failed payments
- video minutes
- infrastructure cost
- retention
- concurrent users

---

# 18. Discovery / Marketplace

The public platform should have:

```text
Home
Communities
Events
Hosts
Categories
Search
Trending
Upcoming
Recommended
```

Recommendation inputs can include:

- interests
- followed hosts
- joined communities
- previous attendance
- category
- location where relevant
- event popularity
- freshness

Start with deterministic recommendations before building ML.

---

# 19. Notifications

Channels:

- in-app
- email
- browser push later

Events:

- event published
- ticket purchased
- event reminder
- event starting
- event cancelled
- refund
- payout
- membership renewal
- new community announcement
- mention
- moderation action

Use a queue for asynchronous delivery.

---

# 20. Admin Platform

Admin portal:

```text
Dashboard
Users
Hosts
Communities
Events
Payments
Payouts
Refunds
Reports
Moderation
Verification
Analytics
System Health
Settings
Audit Logs
```

## Admin capabilities

### Users

- search
- suspend
- restore
- verify
- inspect activity
- view reports

### Hosts

- approve
- reject
- verify
- suspend
- inspect earnings
- inspect events

### Communities

- review
- feature
- suspend
- delete
- inspect reports

### Events

- review
- cancel
- suspend
- feature

### Finance

- payments
- refunds
- platform fees
- host earnings
- payouts
- reconciliation

---

# 21. Moderation and Trust

Implement:

- report user
- report event
- report community
- report message
- block user
- mute user
- ban user
- community moderation
- event moderation
- admin escalation
- audit logs

Potential future additions:

- automated spam detection
- automated harmful-content classification
- risk scoring
- payment fraud detection

Do not make automated moderation the only enforcement mechanism.

---

# 22. Authentication and Security

## Authentication

Implement:

- registration
- login
- logout
- refresh tokens
- password reset
- email verification
- session revocation
- optional MFA later

## Required security fixes from SVSM 1.0

1. Restrict CORS.
2. Remove fallback JWT secret.
3. Move Agora credentials to environment/secret management.
4. Implement Stripe webhook signature verification.
5. Add rate limiting.
6. Add Zod request validation.
7. Fail closed when authorization/billing services fail.
8. Enforce event-level access control.
9. Implement token refresh.
10. Replace unsafe production dev-server configuration.
11. Add HTTPS.
12. Add security headers.
13. Add audit logging.
14. Prevent IDOR by checking ownership/entitlement on every resource.
15. Do not trust frontend roles or prices.

---

# 23. API Architecture

Base:

```text
/api/v1
```

## Auth

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

## Profiles

```text
GET   /profiles/:username
PATCH /profiles/me
POST  /profiles/me/avatar
```

## Communities

```text
POST   /communities
GET    /communities
GET    /communities/:id
PATCH  /communities/:id
DELETE /communities/:id

POST   /communities/:id/join
POST   /communities/:id/leave

GET    /communities/:id/members
PATCH  /communities/:id/members/:userId
DELETE /communities/:id/members/:userId
```

## Community posts

```text
GET    /communities/:id/posts
POST   /communities/:id/posts
GET    /posts/:id
PATCH  /posts/:id
DELETE /posts/:id
POST   /posts/:id/comments
```

## Memberships

```text
GET  /communities/:id/plans
POST /communities/:id/plans
PATCH /plans/:id
POST /plans/:id/subscribe
POST /subscriptions/:id/cancel
```

## Events

```text
POST   /events
GET    /events
GET    /events/:id
PATCH  /events/:id
DELETE /events/:id
POST   /events/:id/publish
POST   /events/:id/cancel
```

## Tickets

```text
GET  /events/:id/tickets
POST /events/:id/tickets
PATCH /tickets/:id
DELETE /tickets/:id
```

## Checkout

```text
POST /events/:id/checkout
GET  /orders/:id
POST /orders/:id/cancel
```

## Live

```text
POST /events/:id/join
POST /events/:id/token
POST /events/:id/end
GET  /events/:id/participants
POST /events/:id/participants/:userId/remove
POST /events/:id/participants/:userId/promote
```

## Payments

```text
GET  /payments
GET  /payments/:id
POST /payments/:id/refund
```

## Stripe

```text
POST /webhooks/stripe
```

## Host

```text
GET /host/dashboard
GET /host/earnings
GET /host/payouts
GET /host/analytics
POST /host/connect/onboard
GET /host/connect/status
```

## Admin

```text
GET /admin/users
GET /admin/hosts
GET /admin/communities
GET /admin/events
GET /admin/payments
GET /admin/payouts
GET /admin/reports
POST /admin/reports/:id/resolve
POST /admin/users/:id/suspend
POST /admin/communities/:id/suspend
```

---

# 24. Stripe Webhook Requirements

The webhook handler must:

1. Verify Stripe signature.
2. Parse event.
3. Check idempotency.
4. Start database transaction.
5. Update payment state.
6. Update order/ticket state.
7. Update entitlement.
8. Calculate platform fee.
9. Record host earning.
10. Record audit event.
11. Queue notification.
12. Return success.

Relevant events will depend on the chosen Stripe Connect architecture, but the implementation must support the lifecycle of checkout, payment, refund, connected-account and payout states used by the final payment design.

---

# 25. Lago Metering Architecture

Lago is retained for infrastructure usage.

## Flow

```text
Meeting ends
    ↓
Usage collector
    ↓
Verify actual media usage
    ↓
Create usage record
    ↓
Queue metering event
    ↓
Lago
    ↓
Store Lago transaction ID
    ↓
Reconcile
```

Required improvements over SVSM 1.0:

- real Agora usage data
- retries
- idempotency
- transaction IDs
- correct balance-after values
- reconciliation
- failure queue
- monitoring
- no hardcoded mock balance in production

---

# 26. Background Jobs

Use a worker/queue architecture.

Jobs:

```text
payment reconciliation
stripe webhook retry
payout synchronization
usage synchronization
Lago reconciliation
ticket hold expiration
event reminders
membership renewal notifications
email delivery
recording processing
analytics aggregation
cleanup
fraud/risk checks
```

Redis can support queue infrastructure; RabbitMQ may be retained if the existing deployment requires it. The final choice should avoid unnecessary duplication.

---

# 27. Caching

Redis use cases:

- session/room state
- rate limiting
- WebSocket pub/sub
- ticket inventory locks
- short-lived checkout/order state
- notification queues
- frequently accessed public event data
- Agora token cache where appropriate

Never treat Redis as the authoritative financial database.

---

# 28. File and Media Storage

Use S3-compatible object storage for:

- avatars
- community images
- event images
- resources
- chat attachments
- recordings
- generated exports

Use signed URLs for private files.

Never expose private storage credentials to clients.

---

# 29. Frontend Application Structure

Recommended:

```text
src/
├── app/
├── routes/
├── components/
├── features/
│   ├── auth/
│   ├── profiles/
│   ├── communities/
│   ├── events/
│   ├── tickets/
│   ├── checkout/
│   ├── live/
│   ├── chat/
│   ├── memberships/
│   ├── host/
│   ├── admin/
│   └── notifications/
├── services/
├── hooks/
├── lib/
├── types/
└── styles/
```

---

# 30. Main User Screens

## Public

```text
Landing page
Explore
Search
Community directory
Event directory
Event details
Host profile
Community profile
Login
Register
```

## User

```text
Home
Discover
My communities
My events
Tickets
Notifications
Profile
Settings
```

## Host

```text
Host dashboard
My communities
Create community
Community manager
Create event
Event manager
Attendees
Tickets
Revenue
Payouts
Analytics
Host settings
```

## Live

```text
Video
Participant list
Chat
Q&A
Polls
Reactions
Screen share
Host controls
```

## Admin

```text
Admin dashboard
Users
Hosts
Communities
Events
Finance
Reports
Moderation
Analytics
System health
Settings
Audit logs
```

---

# 31. Event Access Algorithm

When a user attempts to join:

```text
1. Authenticate user
2. Load event
3. Check event status
4. Check suspension/cancellation
5. Check user account status
6. Check community membership if required
7. Check ticket entitlement if paid
8. Check invitation if invite-only
9. Check seat/access restrictions
10. Check moderator/host role
11. Create meeting participant record
12. Generate role-specific Agora token
13. Return token + room configuration
```

If any required condition fails:

```text
403 FORBIDDEN
```

Do not generate the token.

---

# 32. Idempotency

Required for:

- Stripe webhooks
- checkout completion
- ticket purchase
- refunds
- payout synchronization
- Lago usage events
- notifications
- seat reservation

Use unique IDs and database constraints.

Example:

```text
stripe_event_id UNIQUE
stripe_payment_intent_id UNIQUE
stripe_checkout_session_id UNIQUE
stripe_refund_id UNIQUE
lago_transaction_id UNIQUE
```

---

# 33. Observability

Implement:

- structured logs
- request IDs
- metrics
- health checks
- database monitoring
- queue monitoring
- Stripe webhook monitoring
- Agora error monitoring
- Lago sync monitoring
- alerting

Health endpoints:

```text
/health
/health/live
/health/ready
```

Track:

- API latency
- 4xx/5xx rate
- active meetings
- concurrent users
- WebSocket connections
- payment failures
- webhook failures
- queue depth
- usage-sync failures
- database connection pool
- memory/CPU

---

# 34. Testing Strategy

## Unit tests

- authentication
- permissions
- ticket calculations
- fee calculations
- membership entitlements
- refund calculations
- event state transitions

## Integration tests

- database
- Stripe webhook
- checkout
- ticket reservation
- host payout ledger
- Agora token authorization
- Lago usage sync

## End-to-end tests

Critical flows:

### User

Register → discover → purchase → join → attend → review

### Host

Register → connect Stripe → create community → create event → sell ticket → host event → receive earning

### Refund

Purchase → refund → Stripe confirmation → entitlement removed → financial ledger corrected

### Moderation

Report → admin review → action → notification → audit log

---

# 35. Deployment Architecture

Initial production:

```text
CDN
 ↓
Nginx / Load Balancer
 ↓
API instances
 ├── API 1
 ├── API 2
 └── API N
 ↓
PostgreSQL
Redis
Workers
Object Storage
```

External:

```text
Agora
Stripe
Lago
Email provider
```

Use separate environments:

```text
development
staging
production
```

Never use production secrets in development.

---

# 36. Scaling Strategy

## API

Horizontal scaling.

## PostgreSQL

Start with one production primary.

Later:

- read replicas
- connection pooling
- partitioning for high-volume logs/messages
- archival

## Redis

Cluster when required.

## WebSockets

Use Redis adapter/pub-sub for multiple instances.

## Video

Agora handles media scaling initially.

## Storage

Object storage + CDN.

## Analytics

Move heavy aggregation away from request-time queries as volume grows.

---

# 37. Financial Ledger Rules

Never calculate historical financial reports from current Stripe data alone.

SVSM should maintain an immutable internal ledger.

Every financial event must have:

```text
event ID
user
host
payment
gross
fee
net
currency
status
source provider ID
timestamp
```

Corrections should create adjustment records rather than silently editing history.

---

# 38. Pricing Configuration

Platform admin controls:

```text
default platform fee
host tiers
event fee rules
membership fee rules
refund rules
minimum payout
supported currencies
```

Do not hardcode the platform commission in application logic.

---

# 39. Internationalization

Prepare the data model for:

- multiple currencies
- timezone-aware events
- localization
- multilingual communities
- regional payment methods later

Store event times in UTC plus the host-selected timezone for presentation.

---

# 40. Privacy

Implement:

- privacy policy acceptance
- data deletion workflow
- account export
- consent records
- configurable profile visibility
- private communities
- private events
- private resources
- secure file access

---

# 41. Feature Flags

Use feature flags for:

- memberships
- subscriptions
- polls
- recording
- recommendations
- premium tickets
- new payment flows
- experimental UI

This allows gradual rollout.

---

# 42. Migration from SVSM 1.0

Do not destroy existing data.

## Existing mapping

```text
User              → User + Profile
Session           → Event + Meeting
Transaction       → Infrastructure/Wallet Ledger
UsageRecord       → UsageRecord
facilitatorId     → host_id
recordingUrl      → Meeting/Recording
```

Existing users should receive profiles automatically.

Existing sessions should be represented as legacy events/meetings.

Existing usage records remain linked to their original sessions.

---

# 43. SVSM 2.0 Implementation Phases

## Phase 0 — Architecture freeze

Deliver:

- final domain model
- database ERD
- API contract
- payment flow
- access-control matrix
- service boundaries

## Phase 1 — Stabilize SVSM 1.0 foundation

Fix:

- Stripe webhook
- authentication middleware duplication
- CORS
- JWT secrets
- request validation
- rate limiting
- Agora token refresh
- participant counting
- production Docker build
- usage reconciliation
- Lago transaction IDs
- hardcoded/mock billing
- access control

## Phase 2 — Identity

Build:

- profiles
- usernames
- roles
- verification
- settings
- notifications

## Phase 3 — Communities

Build:

- create community
- community profile
- members
- roles
- posts
- comments
- moderation
- announcements

## Phase 4 — Events

Build:

- event creation
- scheduling
- publishing
- capacity
- ticket tiers
- event discovery
- event lifecycle

## Phase 5 — Marketplace payments

Build:

- Stripe Connect onboarding
- checkout
- paid seats
- payment webhooks
- platform fee ledger
- host earnings
- payouts
- refunds
- reconciliation

## Phase 6 — Live experience

Build:

- entitlement-based joining
- Agora tokens
- role-specific RTC
- token refresh
- chat
- moderation
- screen sharing
- recording
- polls/Q&A/reactions

## Phase 7 — Memberships

Build:

- membership plans
- subscriptions
- member entitlements
- discounts
- premium events
- recurring billing

## Phase 8 — Host business tools

Build:

- earnings
- analytics
- attendance
- community growth
- event conversion
- payout dashboard

## Phase 9 — Discovery

Build:

- search
- categories
- recommendations
- trending
- featured communities
- featured events

## Phase 10 — Admin

Build:

- user administration
- host verification
- community moderation
- event moderation
- finance
- payouts
- refunds
- reports
- analytics
- audit logs

## Phase 11 — Scale and production

Build:

- horizontal API scaling
- workers
- Redis scaling
- database optimization
- CDN
- monitoring
- security testing
- load testing
- disaster recovery

---

# 44. MVP Definition

SVSM 2.0 MVP should NOT attempt every future feature.

### Must-have

- registration/login
- profile
- community creation
- community membership
- event creation
- paid seats
- Stripe payment
- Stripe Connect host onboarding
- platform fee
- host earnings
- ticket/access verification
- Agora live room
- participant management
- chat
- basic moderation
- host dashboard
- admin dashboard
- usage metering
- notifications
- audit logs

### Post-MVP

- subscriptions
- membership tiers
- recommendations
- advanced analytics
- polls
- Q&A
- VIP ticket experiences
- featured communities
- enterprise plans
- mobile applications
- advanced fraud detection
- AI moderation

---

# 45. Critical Business Flow

## Host

```text
Register
 ↓
Create profile
 ↓
Become host
 ↓
Connect Stripe
 ↓
Create community
 ↓
Create event
 ↓
Configure tickets
 ↓
Publish
 ↓
Users purchase
 ↓
Host receives attendees
 ↓
Start live event
 ↓
Manage community
 ↓
Event ends
 ↓
Revenue recorded
 ↓
Payout
```

## Participant

```text
Register
 ↓
Create profile
 ↓
Discover community
 ↓
Follow/join
 ↓
Discover event
 ↓
Select seat
 ↓
Pay
 ↓
Receive entitlement
 ↓
Join live event
 ↓
Chat / participate
 ↓
Leave/review
 ↓
Remain in community
```

---

# 46. The Core Differentiator

SVSM 2.0 should not be marketed internally as:

> "A Zoom alternative."

The product architecture is:

```text
DISCOVERY
    ↓
COMMUNITY
    ↓
EVENT
    ↓
TICKET / MEMBERSHIP
    ↓
PAYMENT
    ↓
LIVE EXPERIENCE
    ↓
ENGAGEMENT
    ↓
COMMUNITY RETENTION
    ↓
NEXT EVENT
    ↓
HOST REVENUE
```

The meeting is one part of a continuous community/business loop.

---

# 47. Final System Boundary

SVSM owns:

- users
- communities
- memberships
- events
- tickets
- entitlements
- host relationships
- platform fees
- financial ledger
- moderation
- discovery
- analytics
- access control
- notifications
- business rules

External providers handle specialized infrastructure:

- Agora → real-time media
- Stripe → payments/connect/payout infrastructure
- Lago → usage metering
- object storage → media/file storage

SVSM remains the **system of record for product state and business logic**.

---

# 48. Definition of Done for SVSM 2.0

SVSM 2.0 is production-ready when:

- users can securely register and authenticate
- users can create/manage profiles
- hosts can onboard for payouts
- communities can be created and managed
- events can be published
- ticket inventory is concurrency-safe
- paid tickets are processed by Stripe
- Stripe webhooks are verified and idempotent
- host/platform financial records reconcile
- refunds correctly reverse entitlements and earnings
- only entitled users can receive live-room access
- Agora tokens are server-generated and refreshable
- live roles are enforced
- chat is real-time and moderated
- communities persist after events
- usage is accurately metered
- Lago synchronization is retryable and reconciled
- admins can manage the ecosystem
- moderation/audit logs exist
- sensitive data and secrets are protected
- production monitoring exists
- automated tests cover financial and access-control paths
- load testing demonstrates the target concurrency
- backups and recovery procedures are tested

---

# 49. Master Principle

**SVSM 1.0 = Video session infrastructure.**

**SVSM 2.0 = Community + Events + Marketplace + Live Experience + Host Monetization.**

The existing SVSM infrastructure becomes the engine underneath the new product rather than being discarded.

