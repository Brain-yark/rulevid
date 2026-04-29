# 🏛️ Civitas — Complete System Documentation

> **Last generated:** April 20, 2026  
> **Codebase location:** `c:\Users\ADMIN\civitas`  
> **Version:** Production-ready MVP (Phase 1–5 implemented)

---

## Table of Contents

1. [System Philosophy & Purpose](#1-system-philosophy--purpose)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Landing Page](#4-landing-page)
5. [Authentication Flow](#5-authentication-flow)
6. [Account Types & Role System](#6-account-types--role-system)
7. [Member Account — Full Feature Set](#7-member-account--full-feature-set)
8. [Facilitator Account — Full Feature Set](#8-facilitator-account--full-feature-set)
9. [Super Admin Account — Full Feature Set](#9-super-admin-account--full-feature-set)
10. [Data Models (Database Schema)](#10-data-models-database-schema)
11. [REST API Endpoints](#11-rest-api-endpoints)
12. [Rules Engine — How It Works](#12-rules-engine--how-it-works)
13. [Reputation System](#13-reputation-system)
14. [Governance Trigger Service](#14-governance-trigger-service)
15. [Notification & Signal System](#15-notification--signal-system)
16. [System Rules (SR) — Constitutional Layer](#16-system-rules-sr--constitutional-layer)
17. [Security & Authentication Infrastructure](#17-security--authentication-infrastructure)
18. [Containerisation & Deployment](#18-containerisation--deployment)
19. [Audit Logging](#19-audit-logging)
20. [Community Templates](#20-community-templates)

---

## 1. System Philosophy & Purpose

Civitas is a **governance-first digital community platform**. It is explicitly *not* a social network. Its core premise is that most online communities fail because their governance structures are informal, opaque, and inconsistent. Civitas solves this by encoding governance into the software itself.

### What Makes Civitas Different

| Traditional Platforms | Civitas |
|---|---|
| Global roles apply everywhere | Roles are community-scoped and localized |
| Admins can delete content silently | Every removal must state which rule was violated |
| No formal appeal mechanism | SR-22: Formal Right to Appeal is a core feature |
| Algorithmic feeds decide what surfaces | No feeds — structured boards with defined scope |
| No audit trail for moderation | Full public audit log, permanently visible |
| One-size-fits-all rules | Context-aware rules per board type |
| Reputation is follower count | Reputation is earned through governance contributions |

### Core Principles (displayed on the Landing Page)

1. **Rules Are Law** — No bending, no exceptions, no hidden moderation.
2. **Governance Is Built-In** — Rules, enforcement, and appeals are part of the software.
3. **Communities Are Sovereign** — Each community defines its own charter, structure, and membership terms.
4. **No Algorithmic Manipulation** — No engagement farming. No feed manipulation. No virality by design.

---

## 2. Technology Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| **React** | 19.2.0 | Core UI framework |
| **TypeScript** | ~5.9.3 | Type-safe JavaScript |
| **Vite** | 7.2.4 | Build tool & dev server |
| **React Router DOM** | 7.12.0 | Client-side routing (SPA) |
| **TailwindCSS** | 3.4.17 | Utility-first CSS framework |
| **Lucide React** | 0.562.0 | Icon library |
| **Axios** | 1.13.2 | HTTP client for API calls |
| **class-variance-authority** | 0.7.1 | Component variant management |
| **clsx** | 2.1.1 | Conditional class merging |
| **tailwind-merge** | 3.4.0 | Tailwind class conflict resolution |
| **vite-plugin-pwa** | 1.2.0 | Progressive Web App (PWA) support |

**PWA Configuration:** The app is installable on mobile and desktop. It runs in `standalone` display mode with `autoUpdate` service worker registration, a dark theme (`#0b0e14`), and a `navigateFallback` to `index.html` for SPA routing offline support.

### Backend

| Technology | Version | Role |
|---|---|---|
| **Django** | ≥5.0 | Web framework |
| **Django REST Framework (DRF)** | Latest | REST API layer |
| **djangorestframework-simplejwt** | Latest | JWT authentication |
| **django-cors-headers** | Latest | Cross-Origin Resource Sharing |
| **django-environ** | Latest | Environment variable management |
| **django-filter** | Latest | API filtering |
| **Pillow** | Latest | Image upload processing |
| **psycopg2-binary** | Latest | PostgreSQL database adapter |
| **pytest-django** | Latest | Automated test suite |

### Database

| Environment | Database |
|---|---|
| Development | SQLite 3 (via `db.sqlite3`) |
| Production | PostgreSQL (via `psycopg2-binary`, `DATABASE_URL` env var) |

### Infrastructure

| Component | Technology |
|---|---|
| **Containerisation** | Docker + Docker Compose |
| **Orchestration** | Kubernetes manifests (in `k8s/` directory) |
| **Reverse Proxy** | Nginx (serving built frontend, proxying `/api/` to Django) |
| **WSGI Server** | Django's built-in (Gunicorn-ready for production) |

### API Configuration

- **Base URL:** `/api/`
- **Auth endpoint:** `/api/token/` (JWT obtain), `/api/token/refresh/` (token refresh)
- **Default pagination:** 20 items per page
- **Rate limiting:** Anonymous = 100 req/day; Authenticated = 1000 req/day
- **JWT token lifetime:** Access = 60 minutes, Refresh = 1 day

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER / PWA                        │
│                   React 19 + TypeScript SPA                 │
│              (Vite dev server / Nginx in prod)              │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS / HTTP (Axios)
                          │ JWT Bearer Token in headers
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     NGINX REVERSE PROXY                     │
│     / → serves dist/index.html (React SPA)                  │
│     /api/ → proxies to Django backend :8000                 │
│     /media/ → serves uploaded files                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  DJANGO 5 + DRF BACKEND                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  ViewSets   │  │  Services    │  │  Signals           │ │
│  │  (views.py) │  │ RulesService │  │ notify_discussion  │ │
│  │             │  │ ReputationSv │  │ notify_response    │ │
│  │  UserVS     │  │ GovernanceTr │  │ notify_follow      │ │
│  │  CommunityVS│  └──────────────┘  └────────────────────┘ │
│  │  BoardVS    │                                            │
│  │  ...16 VSets│  ┌──────────────────────────────────────┐ │
│  └─────────────┘  │        JWT Authentication            │ │
│                   │   EmailOrUsernameModelBackend        │ │
│                   └──────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                           │
│               SQLite (dev) / PostgreSQL (prod)              │
│   15 core models: User, Community, Board, SubBoard,        │
│   Discussion, Response, Rule, RuleDecision, Report,         │
│   ModerationAction, Appeal, Vote, InviteCode,               │
│   DirectMessage, Notification, Follow                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Landing Page

**Route:** `/`  
**File:** `src/pages/LandingPage.tsx`

The landing page is the public face of the platform. It is a single-page marketing site that explains the system's philosophy before a user creates an account.

### Navbar
- Displays the Civitas logo (linking back to `/` or to the user's dashboard if authenticated).
- **Desktop nav links:** Principles, How It Works, Roles, and either "Enter" (sign in link) or "Dashboard" button if already logged in.
- **Mobile hamburger menu** with the same links, animated with a slide-in effect.
- **PWA Install button** — appears only when the browser supports installation via the `usePWAInstall` hook. Triggers the native OS install prompt.

### Hero Section
- Headline: **"Governed communities, not social feeds."**
- Sub-headline explaining the anti-social-media philosophy.
- Two primary CTAs:
  - **"Create a Community"** → `/auth/signup?role=facilitator`
  - **"Join as a Member"** → `/auth/signup?role=member`

### "Not Social" Strip
Displays 5 things Civitas explicitly does NOT do:
1. No algorithmic feeds
2. No silent moderation
3. No likes or virality
4. No one-size-fits-all rules
5. No unaccountable admins

### Core Principles Section
4 principle cards:
- Rules Are Law
- Governance Is Built-In
- Communities Are Sovereign
- No Algorithmic Manipulation

### Platform Features Grid (6 cards)
| ID | Feature | Description |
|----|---------|-------------|
| LG | Localized governance | Permissions are community-specific |
| RE | Reputation engine | Authority earned through contributions |
| AL | Public audit logs | Every action logged with rule and reason |
| CB | Context-aware boards | Technical/civic/research boards have different rules |
| RA | Right to appeal | SR-22 appeal system built in |
| DM | Direct messaging | Peer-to-peer private messaging |

### Roles Section
Side-by-side comparison of the two primary user roles:
- **Facilitator card**: Create community, set governance strictness, assign co-facilitators, moderation panel, manage access types.
- **Member card**: Browse directory, apply to restricted communities, build reputation, access boards, appeal decisions.

### System Rules Section
4 constitutional rules displayed as badges:
- **SR-8:** No silent moderation
- **SR-9:** No editing member content
- **SR-12:** Secure invite system
- **SR-22:** Right to appeal

### Audit Log Demo
A mock audit log terminal showing real examples of moderation actions and appeals.

### Civitas vs. Competitors Table
Explicit comparison against Discord, Slack, and Facebook Groups.

### How It Works (Step-by-step)
1. Facilitator creates a charter
2. Members apply or join
3. Participation is structured
4. Violations are enforced transparently

### Join CTA
Final call-to-action with a deliberate warning: *"You will be expected to read rules, follow them, and accept consequences."*

### Footer
- Copyright 2026
- Links to Governance, About, GitHub, Contact

---

## 5. Authentication Flow

### Registration (`/auth/signup`)
1. User visits `/auth/signup?role=facilitator` or `?role=member`.
2. Fills in username, email, password.
3. `POST /api/users/register/` creates the account (open endpoint, no auth required).
4. User is redirected to `/auth/role-confirmation` to confirm their role selection.
5. First-time members are then redirected to `/auth/governance-orientation` — a mandatory walkthrough of the platform's governance rules. They cannot skip it.
6. On completing the orientation, `POST /api/users/complete_orientation/` is called, setting `has_completed_orientation = true` on the user record.

### Sign In (`/auth/signin`)
1. User enters username or email + password.
2. `POST /api/token/` returns `{ access, refresh }` JWT tokens.
3. The `access` token is stored in `localStorage` as `civitas_token`.
4. The `refresh` token is stored as `civitas_refresh`.
5. `GET /api/users/me/` is immediately called to load the user's full profile including `role`.
6. The role is stored as `civitas_role` in localStorage.
7. Based on role, the user is redirected to `/facilitator/home` (FACILITATOR/CO_FACILITATOR) or `/member/home` (MEMBER).

### JWT Refresh
The Axios instance (`src/services/api.ts`) has an interceptor that automatically refreshes the access token using `civitas_refresh` when a 401 is received.

### Auth Guard (`ProtectedRoute`)
- The `ProtectedRoute` component wraps all protected routes.
- It accepts an `allowedRoles` array.
- Unauthenticated users are redirected to `/auth/signin`.
- Users with the wrong role are redirected appropriately.
- The `/admin` route has no `ProtectedRoute` — it relies on a backend `IsSystemAdmin` permission class.

### Email or Username Login
The backend uses a custom `EmailOrUsernameModelBackend` that allows users to authenticate with either their username or email address.

---

## 6. Account Types & Role System

Civitas has **four distinct roles**, split into two levels: platform-level and community-level.

### Platform-Level Roles (stored on `User.role`)

| Role | Code | Description |
|------|------|-------------|
| Member | `MEMBER` | Regular platform participant |
| Facilitator | `FACILITATOR` | Community creator and primary admin |
| Co-Facilitator | `CO_FACILITATOR` | Delegated community moderator |
| Super Admin | `SYSTEM` | Platform-wide god-mode oversight |

### Community-Level Roles (stored on `CommunityMember.role`)

Within any specific community, a user can hold a **different role** to their platform role. A platform `MEMBER` can be a `FACILITATOR` within one specific community.

| Role | Permissions Within a Community |
|------|-------------------------------|
| `MEMBER` | Post, respond, vote, report, follow, appeal |
| `CO_FACILITATOR` | All above + manage applications, review reports |
| `FACILITATOR` | All above + full structural control, kick/suspend members |

> **Note:** The `SYSTEM` role is special. It cannot create, edit, or delete community content — it is deliberately restricted to oversight only. This is enforced in the backend `DiscussionViewSet`, `ResponseViewSet`, etc.

---

## 7. Member Account — Full Feature Set

**Base route:** `/member`  
**Layout:** `MemberLayout` — includes a persistent top navbar and sidebar navigation.  
**Access:** All users with role `MEMBER`, `FACILITATOR`, or `CO_FACILITATOR`.

### 7.1 Member Home (`/member/home`)
**File:** `src/pages/Member/MemberHome.tsx`

The member's personal dashboard. Shows:
- Summary of communities the user has joined.
- Recent activity notifications.
- Reputation score display.
- Quick links to the community directory.

### 7.2 Community Directory (`/member/communities`)
**File:** `src/pages/Member/CommunityDirectory.tsx`

A searchable, filterable list of all communities on the platform.
- Shows community name, description, member count, discussion count.
- Indicates access type (OPEN / APPLICATION / INVITE).
- Members can click through to a community's profile page.
- Filter/search functionality.

### 7.3 Community Profile (`/member/community/:id`)
**File:** `src/pages/Member/CommunityProfile.tsx`

A read-only view of a community before joining.
- Shows community image, banner, description, governance type.
- Membership count, board structure preview.
- Join button (behavior depends on `access_type`):
  - **OPEN:** Immediately joins via `POST /api/communities/:id/join/`.
  - **APPLICATION:** Submits an application (status becomes `PENDING`).
  - **INVITE:** Shows invite code input field.

### 7.4 Community Application (`/member/community/:id/apply`)
**File:** `src/pages/Member/CommunityApplication.tsx`

A formal application form for APPLICATION-type communities. The user writes a statement. The facilitator reviews it from their panel.

### 7.5 Inside a Community (Community Layout)

Once a member is an active member of a community, they access it via the `CommunityLayout`:

**Route:** `/member/community/:id/` with sub-routes:

#### Community Home (`/member/community/:id/home`)
**File:** `src/pages/Community/CommunityHome.tsx`
- Displays all boards within the community.
- Each board shows sub-boards and recent activity.

#### Board View (`/member/community/:id/board/:boardId`)
**File:** `src/pages/Community/BoardView.tsx`
- Shows all sub-boards within a board.
- Sub-board cards with topic, description, and discussion count.

#### Sub-Board View (`/member/community/:id/board/:boardId/sub/:subBoardId`)
**File:** `src/pages/Community/SubBoardView.tsx`
- Lists all discussions within a sub-board.
- Shows discussion author, type, creation date, response count, vote scores.
- Follow/unfollow button for the sub-board.

#### Create Discussion (`/member/community/:id/board/:boardId/sub/:subBoardId/create`)
**File:** `src/pages/Community/CreateDiscussion.tsx`
- Form to create a new discussion thread.
- Fields: Title, Content, Type (Proposal / Question / Evidence / Directive), Sources (URLs), optional image.
- On submit, the **Rules Engine** evaluates the action before saving.
- If blocked by a governance rule, the user sees an error with the rule code and message.

#### Discussion Detail (`/member/community/:id/discussion/:discussionId`)
**File:** `src/pages/Community/DiscussionDetail.tsx`
- Full discussion thread view.
- Shows discussion content, author, type, vote counts, images.
- Lists all responses (replies).
- **Upvote/Downvote** buttons for discussions and responses.
- **Response form** with type selection: Clarification / Challenge / Supporting Evidence / Facilitator Intervention.
- Each response also goes through the Rules Engine.
- Report button on discussions and responses.
- Facilitator responses are marked with an "Official" badge.

### 7.6 Member Profile (`/member/profile`, `/member/profile/:username`)
**File:** `src/pages/Member/Profile.tsx`

- View/edit own profile (avatar, bio, phone, Facebook profile link).
- View another user's public profile by username.
- Displays reputation score prominently.
- Shows communities the user belongs to.
- `PATCH /api/users/me/` to update profile fields.
- Supports avatar image upload (multipart form).

### 7.7 Direct Messages (`/member/messages` — linked from Profile)
**File:** `src/pages/Member/DirectMessages.tsx`

Peer-to-peer private messaging system:
- Shows a conversation list (all users the current user has messaged with).
- Click a conversation to open the full message thread.
- Compose new messages.
- Messages are marked read on opening.
- **API calls used:**
  - `GET /api/direct-messages/conversations/` — list of people messaged
  - `GET /api/direct-messages/?sender=X&receiver=Y` — thread
  - `POST /api/direct-messages/` — send a message
  - `POST /api/direct-messages/mark_as_read/` — mark conversation read

### 7.8 Invite / Join by Code (`/member/invite/:code`)
**File:** `src/pages/Member/InviteJoin.tsx`

- User lands here from an invite link.
- The invite code is validated via `GET /api/invites/validate/?code=XXX`.
- On confirming, `POST /api/invites/:code/join/` consumes the invite and creates the membership.

### 7.9 Moderation History (`/member/moderation-history`)
**File:** `src/pages/Member/ModerationHistory.tsx`

- Shows all moderation actions that have been taken **against** the current user.
- Displays: action type, reason, which rule was cited, who issued it, when.
- For each action, if not yet appealed, shows an **"Appeal This Decision"** button.
- Filing an appeal sends `POST /api/appeals/` with the moderation action ID and appeal reason.

### 7.10 Member Notifications (`/member/notifications`)
**File:** `src/pages/Member/Notifications.tsx`

- Lists all notifications for the current user, latest first.
- Types: new reply, new thread in followed board, mute applied, appeal resolved.
- Mark individual or all notifications as read.
- **API:** `GET /api/notifications/`, `POST /api/notifications/:id/mark_as_read/`, `POST /api/notifications/mark_all_as_read/`

---

## 8. Facilitator Account — Full Feature Set

**Base route:** `/facilitator`  
**Layout:** `FacilitatorLayout` — sidebar with full management navigation.  
**Access:** Role must be `FACILITATOR` or `CO_FACILITATOR`.

### 8.1 Facilitator Dashboard (`/facilitator/home`)
**File:** `src/pages/Facilitator/Dashboard.tsx`

The command center for a facilitator. Shows:
- All communities they manage with member counts.
- Recent member activity across their communities.
- Pending applications needing review.
- Recent moderation actions.
- Quick stats (boards, discussions, responses).

### 8.2 Communities List (`/facilitator/communities`)
**File:** `src/pages/Facilitator/CommunitiesList.tsx`

- Lists all communities the facilitator manages.
- Quick links to manage, moderate, or view security context for each.
- "Create Community" button.

### 8.3 Create Community (`/facilitator/create-community`)
**File:** `src/pages/Facilitator/CreateCommunity.tsx`

A detailed multi-step form:

**Step 1: Identity**
- Community name, description
- Upload image and banner

**Step 2: Template Selection**
Choosing a template pre-populates the initial board structure:
| Template | Auto-created Boards |
|----------|---------------------|
| `GENERAL` | Announcements, General |
| `TECHNICAL` | Announcements, Dev-Log, Bug-Tracker, Technical-Discussion |
| `CIVIC` | Announcements, Constitutional-Drafting, Public-Forum, Legal-Review |
| `RESEARCH` | Announcements, Hypothesis-Testing, Data-Review, White-Papers |

**Step 3: Access & Governance**
- **Access type:** OPEN / APPLICATION / INVITE
- **Governance strictness:** LOW / MEDIUM / HIGH (affects default rules)

On submit: `POST /api/communities/`  
On creation, the creator is **automatically** made a `FACILITATOR` member with `ACTIVE` status.

### 8.4 Community Management (`/facilitator/community/:id/manage`)
**File:** `src/pages/Facilitator/CommunityManagement.tsx` (78KB — the largest file)

This is the main command panel for a specific community. Sections include:

#### Board Management
- Create, rename, delete boards.
- Create sub-boards within boards (with topic, description, sources).
- Assign `BoardType` (TECHNICAL, CIVIC_DIALOGUE, RESEARCH, GENERAL) to boards for context-aware moderation.

#### Member Management (within Community Management)
- View all active members.
- Promote/demote member roles (`POST /api/communities/:id/promote_member/`).
- Add additional facilitators (`POST /api/communities/:id/add_facilitator/`).

#### Community Settings
- Update name, description, image, banner.
- Change access type and governance type.
- Update JSON `settings` field.

#### Invite Code Generation
- For INVITE communities, generate invite codes.
- Set max uses and expiry date.
- Share the invite link.

#### Application Queue
- View all pending membership applications.
- Approve or reject each (`POST /api/communities/:id/respond_to_application/`).

### 8.5 Members Management (`/facilitator/members`)
**File:** `src/pages/Facilitator/MembersManagement.tsx`

Platform-wide member management across all facilitated communities:
- Table of all members across managed communities.
- Filter by community, role, status.
- **Kick member** — `POST /api/community-members/:id/kick/` (deletes the membership).
- **Suspend member** — `POST /api/community-members/:id/suspend/` (sets status to `SUSPENDED`).

### 8.6 Rules Builder (`/facilitator/rules`, `/facilitator/rules/create`, `/facilitator/rules/:id/edit`)
**Files:** `src/pages/Facilitator/RulesList.tsx`, `src/pages/Facilitator/RuleBuilder.tsx` (24KB)

The most powerful feature in the facilitator's toolkit. Allows creating custom governance rules that integrate with the Rules Engine.

**RulesList** — shows all active and inactive rules for managed communities.

**RuleBuilder** — a form to create or edit a rule with fields:

| Field | Options | Meaning |
|-------|---------|---------|
| `scope_type` | PLATFORM / COMMUNITY / BOARD / SUB_BOARD / DISCUSSION | Where the rule applies |
| `action` | CREATE_DISCUSSION / RESPOND / ENDORSE / CHALLENGE / CLARIFY / EDIT / FLAG | What action it governs |
| `role` | MEMBER / CO_FACILITATOR / FACILITATOR | Who the rule targets |
| `is_system` | Boolean | Constitutional (unbreakable) vs. configurable |
| `conditions` | JSON | `max_per_day`, `max_per_hour`, `requires_sources`, `requires_reason`, `max_reports`, `member_age` |
| `enforcement` | JSON | `{ type: "BLOCK"/"WARN", message: "..." }` |
| `active` | Boolean | Enable/disable the rule |
| `code` | String e.g. "SR-15" | Human-readable rule identifier |

### 8.7 Moderation Dashboard (`/facilitator/moderation`)
**File:** `src/pages/Facilitator/ModerationDashboard.tsx`

Overview of all moderation activity across managed communities:
- Total reports, pending reports
- Total moderation actions by type
- Open appeals
- Recent activity timeline

### 8.8 Moderation Panel (`/facilitator/community/:id/moderation`)
**File:** `src/pages/Facilitator/ModerationPanel.tsx`

Community-specific moderation interface:

**Reports Tab**
- All flagged content (discussions and responses).
- Can view the content, reporter's reason.
- Can dismiss the report or take action.

**Actions Tab**
- Issue a formal moderation action: REMOVE / WARN / RESTRICT / MUTE.
- Must select the target user.
- Must select which Rule was violated.
- Must write a reason.
- For MUTE, must specify duration.
- On submit: `POST /api/moderation-actions/` — deducts reputation from target.

**Appeals Tab**
- View all open appeals from community members.
- Read the original moderation action and the member's appeal statement.
- Approve or reject the appeal with a decision reason.
- `POST /api/appeals/:id/decide/` with `{ decision: "APPROVED"/"REJECTED", decision_reason: "..." }`
- If approved: mute is lifted automatically, reputation is restored.

### 8.9 Security Context (`/facilitator/community/:id/security`)
**File:** `src/pages/Facilitator/SecurityContext.tsx` (16KB)

An advanced security view for the community:
- Real-time rule decision audit log (all BLOCKED actions).
- Reputation distribution of members.
- Currently muted users.
- Report heatmap.
- Invite code usage statistics.
- Context-aware board term analysis (which disallowed terms have been triggered).

### 8.10 Facilitator Profile (`/facilitator/profile`)
**File:** `src/pages/Facilitator/Profile.tsx`

Same as member profile but within the facilitator layout.

### 8.11 Facilitator Notifications (`/facilitator/notifications`)
**File:** `src/pages/Facilitator/Notifications.tsx`

Same notification system but facilitators receive additional notices:
- New member followed a board in their community.
- Member unfollowed (Follower Reduction Alert).
- Pending applications.
- Appeal status updates.

---

## 9. Super Admin Account — Full Feature Set

**Base route:** `/admin`  
**Layout:** `AdminLayout` — dark, high-contrast command center design.  
**Access:** Backend enforces `IsSystemAdmin` permission class (`role == 'SYSTEM'` OR `is_superuser == True`). The frontend `/admin` route has **no client-side ProtectedRoute** — security is entirely API-enforced.

> **Critical design decision:** The SYSTEM role is an **oversight role only**. It is blocked from creating, editing, or deleting community content by the backend. This prevents the platform operator from interfering in community affairs.

### 9.1 Super Admin Dashboard (`/admin/dashboard`)
**File:** `src/pages/Admin/SuperAdminDashboard.tsx`

A live, auto-refreshing (every 10 seconds) KPI dashboard powered by `GET /api/admin/stats/`.

**Section 1 — User Statistics (8 stat cards)**
- Total Users (all time)
- New Today (since midnight)
- New This Week (7 days)
- Active Mutes (alert: red if > 0)
- Average Reputation (platform-wide)
- Orientation Completed count
- New This Month (30 days)
- Roles Breakdown (MEMBER / FACILITATOR / CO_FACILITATOR / SYSTEM counts)

**Section 2 — Communities & Content (6 stat cards)**
- Total Communities
- Total Boards
- Total Sub-Boards
- Total Discussions
- Total Responses
- Posts Today (combined discussions + responses)

**Section 3 — Governance Engine (6 stat cards)**
- Active Rules (of total)
- Decisions Today (rule evaluations)
- Blocked Today (alert: red if > 0)
- Allowed Today
- Total Decisions (all time)
- Block Rate (% shown as progress bar)

**Section 4 — Moderation Status (6 stat cards)**
- Pending Reports (alert if > 0)
- Open Appeals (alert if > 0)
- Total Moderation Actions
- Actions by Type breakdown table (REMOVE / WARN / RESTRICT / MUTE counts)

**Section 5 — Engagement Metrics (7 stat cards)**
- Total Votes
- Upvotes
- Downvotes (alert if > upvotes)
- Direct Messages
- Notifications (total)
- Unread Notifications (alert if > 20)
- Follows (board/sub subscriptions)

### 9.2 Admin Users Page (`/admin/users`)
**File:** `src/pages/Admin/AdminUsersPage.tsx`

Full user management table:
- Search by username or email.
- Filter by role.
- Columns: Username, Email, Role, Reputation, Mute status, Orientation status, Join Date, Community Count, Discussion Count, Report Count.
- Can toggle mute status directly.
- Can change platform role.
- `GET /api/admin/users/` and `PATCH /api/admin/users/:id/`

### 9.3 Admin Communities Page (`/admin/communities`)
**File:** `src/pages/Admin/AdminCommunitiesPage.tsx`

Platform-wide community management:
- Full list of all communities regardless of who created them.
- View details, member counts, template, access type.
- Admin can dissolve/intervene in any community.

### 9.4 Admin Moderation Page (`/admin/moderation`)
**File:** `src/pages/Admin/AdminModerationPage.tsx` (12KB)

Cross-community moderation oversight:
- All pending reports from every community.
- All open appeals from every community.
- All recent moderation actions.
- Ability to review and mark reports.
- Ability to decide appeals (overriding community facilitators).

### 9.5 Admin Analytics Page (`/admin/analytics`)
**File:** `src/pages/Admin/AdminAnalyticsPage.tsx` (9KB)

Deeper analytics and trends:
- User growth over time.
- Content creation over time.
- Governance rule effectiveness metrics.
- Community health scoring.
- Reputation distribution charts.

### 9.6 Admin API Explorer (`/admin/api-explorer`)
**File:** `src/pages/Admin/AdminApiExplorerPage.tsx` (11KB)

An in-platform API explorer for the admin to make direct API calls:
- Dropdown to select endpoint.
- Method selector (GET / POST / PATCH / DELETE).
- JSON body editor.
- Live response viewer.
- Useful for debugging and direct database operations.

---

## 10. Data Models (Database Schema)

All primary keys are **UUID v4** (not sequential integers) to prevent ID enumeration attacks.

### User
Extended from Django's `AbstractUser`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `username` | String | Unique login handle |
| `email` | String | Optional, used for login |
| `role` | Enum | `MEMBER` / `FACILITATOR` / `CO_FACILITATOR` / `SYSTEM` |
| `avatar` | ImageField | Profile picture (stored in `media/avatars/`) |
| `bio` | Text | Up to 500 chars |
| `phone` | String | Optional contact |
| `facebook_profile` | String | Optional social link |
| `is_muted` | Boolean | Platform-wide mute flag |
| `mute_until` | DateTime | When the mute expires |
| `reputation_score` | Integer | Starts at 100, min is 0 (triggers auto-mute) |
| `has_completed_orientation` | Boolean | Whether onboarding is done |

### Community

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Community name |
| `description` | Text | Optional description |
| `access_type` | String | `OPEN` / `APPLICATION` / `INVITE` |
| `governance_type` | String | `LOW` / `MEDIUM` / `HIGH` |
| `image` | ImageField | Community icon |
| `banner` | ImageField | Community banner |
| `template` | Enum | `GENERAL` / `TECHNICAL` / `CIVIC` / `RESEARCH` |
| `settings` | JSON | Flexible settings dict |
| `members` | M2M → User | Through `CommunityMember` |

### CommunityMember (Join Table)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user` | FK → User | |
| `community` | FK → Community | |
| `role` | Enum | `MEMBER` / `CO_FACILITATOR` / `FACILITATOR` |
| `status` | String | `ACTIVE` / `PENDING` / `SUSPENDED` / `REJECTED` |
| `joined_at` | DateTime | Auto-set on creation |

**Unique together:** `(user, community)` — a user can only have one membership per community.

### Board

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Board display name |
| `ref` | String | Unique URL-safe reference |
| `community` | FK → Community | Parent community |
| `board_type` | FK → BoardType | Context for moderation |
| `image` | ImageField | Board image |

### SubBoard

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | |
| `topic` | String | Subject focus |
| `description` | Text | |
| `board` | FK → Board | Parent board |
| `sources` | JSON | List of reference URLs |

### Discussion

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `title` | String | Thread title |
| `type` | String | `Proposal` / `Question` / `Evidence` / `Directive` |
| `content` | Text | Body content |
| `author` | FK → User | |
| `sub_board` | FK → SubBoard | |
| `image` | ImageField | Optional attachment |
| `sources` | JSON | Reference URLs |
| `created_at` | DateTime | |

*Vote counts `upvotes` and `downvotes` are **annotated** via SQL subqueries on the queryset — no stored columns.*

### Response

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `content` | Text | Reply content |
| `type` | String | `Clarification` / `Challenge` / `Supporting Evidence` / `Facilitator Intervention` |
| `is_official` | Boolean | True if from a facilitator — shown with badge |
| `author` | FK → User | |
| `discussion` | FK → Discussion | |
| `image` | ImageField | |
| `created_at` | DateTime | |

### Rule

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `code` | String | e.g. `SR-9`, `R-003`, unique |
| `is_system` | Boolean | Constitutional if true — cannot be overridden |
| `description` | Text | Human-readable description |
| `scope_type` | Enum | `PLATFORM` / `COMMUNITY` / `BOARD` / `SUB_BOARD` / `DISCUSSION` |
| `scope_id` | UUID | ID of the specific scope entity (null = platform-wide) |
| `action` | Enum | `CREATE_DISCUSSION` / `RESPOND` / `ENDORSE` / `CHALLENGE` / `CLARIFY` / `EDIT` / `FLAG` |
| `role` | String | Which role this rule applies to |
| `conditions` | JSON | `{ max_per_day, max_per_hour, requires_sources, requires_reason, max_reports, member_age }` |
| `enforcement` | JSON | `{ type: "BLOCK", message: "..." }` |
| `active` | Boolean | |

### RuleDecision (Audit Log Entries)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `user` | FK → User | Who triggered the evaluation |
| `action` | String | What action was attempted |
| `scope_type` | String | |
| `scope_id` | UUID | |
| `result` | Enum | `ALLOWED` / `BLOCKED` / `QUEUED` |
| `rule` | FK → Rule | Which rule triggered the decision (nullable) |
| `reason` | Text | |
| `timestamp` | DateTime | |

### BoardType

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `key` | Enum | `TECHNICAL` / `CIVIC_DIALOGUE` / `RESEARCH` / `GENERAL` |
| `name` | String | Display name |
| `description` | Text | |
| `tone_guidelines` | Text | Context-specific communication expectations |
| `requires_citations` | Boolean | If true, sources are mandated |

### BoardTypeTerm

Per-board-type dictionary of terms for context-aware content moderation.

| Field | Type | Description |
|-------|------|-------------|
| `board_type` | FK → BoardType | |
| `term` | String | The word/phrase |
| `term_type` | Enum | `ALLOWED` / `CONTEXTUAL` / `DISALLOWED` |

*Example: The word "kill" is `ALLOWED` in a TECHNICAL board (kill -9 process) but `DISALLOWED` in GENERAL.*

### Report

| Field | Type | Description |
|-------|------|-------------|
| `reporter` | FK → User | |
| `content_type` | String | `DISCUSSION` or `RESPONSE` |
| `object_id` | UUID | ID of the flagged item |
| `reason` | Text | |
| `status` | String | `PENDING` / `REVIEWED` / `DISMISSED` |

### ModerationAction

| Field | Type | Description |
|-------|------|-------------|
| `action` | Enum | `REMOVE` / `WARN` / `RESTRICT` / `MUTE` |
| `rule` | FK → Rule | Which rule was cited (SR-8: mandatory) |
| `moderator` | FK → User | Who issued it |
| `target_user` | FK → User | Who it was issued against |
| `reason` | Text | Mandatory written reason |
| `duration` | String | For MUTE actions (e.g. "24h", "48h") |

### Appeal

| Field | Type | Description |
|-------|------|-------------|
| `moderation_action` | FK → ModerationAction | What is being contested |
| `appellant` | FK → User | Who filed the appeal |
| `appeal_reason` | Text | The member's argument |
| `status` | Enum | `PENDING` / `APPROVED` / `REJECTED` |
| `decision_reason` | Text | Facilitator's explanation |
| `decided_by` | FK → User | |
| `decided_at` | DateTime | |

### Vote

| Field | Type | Description |
|-------|------|-------------|
| `user` | FK → User | |
| `content_type` | String | `DISCUSSION` or `RESPONSE` |
| `object_id` | UUID | |
| `vote_type` | Enum | `UP` or `DOWN` |

**Unique together:** `(user, content_type, object_id)` — one vote per item per user. Casting the same vote again removes it (toggle). Casting the opposite switches it.

### InviteCode

| Field | Type | Description |
|-------|------|-------------|
| `code` | String | Unique invite code |
| `community` | FK → Community | |
| `creator` | FK → User | |
| `max_uses` | Integer | |
| `current_uses` | Integer | |
| `expires_at` | DateTime | Optional expiry |
| `is_active` | Boolean | Can be manually deactivated |

### DirectMessage

| Field | Type | Description |
|-------|------|-------------|
| `sender` | FK → User | |
| `receiver` | FK → User | |
| `content` | Text | |
| `is_read` | Boolean | |
| `timestamp` | DateTime | |

### Notification

| Field | Type | Description |
|-------|------|-------------|
| `user` | FK → User | Recipient |
| `title` | String | |
| `message` | Text | |
| `link` | String | Frontend route to link to |
| `is_read` | Boolean | |
| `created_at` | DateTime | |

### Follow

| Field | Type | Description |
|-------|------|-------------|
| `user` | FK → User | |
| `content_type` | String | `BOARD` or `SUB_BOARD` |
| `object_id` | UUID | ID of the board or sub-board |

---

## 11. REST API Endpoints

**Base path:** `/api/`  
**Auth:** All endpoints require `Authorization: Bearer <token>` except registration and JWT token endpoints.

### Standard ViewSet Endpoints (DRF Router)

Each ViewSet automatically generates these standard routes:

| Method | URL | Action |
|--------|-----|--------|
| GET | `/api/{resource}/` | List |
| POST | `/api/{resource}/` | Create |
| GET | `/api/{resource}/:id/` | Retrieve |
| PUT/PATCH | `/api/{resource}/:id/` | Update |
| DELETE | `/api/{resource}/:id/` | Destroy |

### Registered ViewSets

| Resource | ViewSet | Key Notes |
|----------|---------|-----------|
| `users` | UserViewSet | Open `register` action, `me` endpoint |
| `communities` | CommunityViewSet | Filterable by `managed=true`, `joined=true` |
| `boards` | BoardViewSet | Filterable by `?community=ID` |
| `sub-boards` | SubBoardViewSet | Filterable by `?community=ID&board=ID` |
| `discussions` | DiscussionViewSet | Rules Engine enforced on create |
| `responses` | ResponseViewSet | Rules Engine enforced on create |
| `rules` | RuleViewSet | Full CRUD for facilitators |
| `audit-logs` | RuleDecisionViewSet | Read-only; filterable by `scope_id`, `result`, `limit` |
| `community-members` | CommunityMemberViewSet | Filterable by `?managed=true&community=ID` |
| `notifications` | NotificationViewSet | User-scoped |
| `follows` | FollowViewSet | User-scoped, `toggle` and `status` actions |
| `votes` | VoteViewSet | Toggle/switch logic in `perform_create` |
| `direct-messages` | DirectMessageViewSet | User-scoped; `conversations`, `mark_as_read` actions |
| `board-types` | BoardTypeViewSet | Read-only |
| `board-type-terms` | BoardTypeTermViewSet | Read-only, filterable by `?board_type=ID` |
| `reports` | ReportViewSet | Members see own; Facilitators see all |
| `moderation-actions` | ModerationActionViewSet | `target_user` filter; reputation deducted on create |
| `appeals` | AppealViewSet | `decide` action for facilitators |
| `invites` | InviteCodeViewSet | Facilitator-scoped; `validate`, `join` actions |

### Custom User Actions

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/users/register/` | Open registration |
| GET/PATCH | `/api/users/me/` | Current user profile |
| POST | `/api/users/complete_orientation/` | Mark orientation done |

### Custom Community Actions

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/communities/:id/join/` | Join community (respects access type) |
| POST | `/api/communities/:id/add_facilitator/` | Promote user to facilitator |
| POST | `/api/communities/:id/promote_member/` | Change a member's community role |
| POST | `/api/communities/:id/respond_to_application/` | Approve/reject application |

### Custom Member Actions

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/community-members/:id/suspend/` | Suspend a member |
| POST | `/api/community-members/:id/kick/` | Remove a member entirely |

### Custom Appeal Actions

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/appeals/:id/decide/` | Approve or reject an appeal |

### Custom Notification Actions

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/notifications/:id/mark_as_read/` | Mark single notification read |
| POST | `/api/notifications/mark_all_as_read/` | Mark all read |
| GET | `/api/notifications/unread_count/` | Returns `{ count: N }` |

### JWT Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/token/` | Obtain access + refresh tokens |
| POST | `/api/token/refresh/` | Exchange refresh for new access token |

### Super Admin Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/admin/stats/` | Full platform KPIs |
| GET | `/api/admin/users/` | All users with metadata |
| PATCH | `/api/admin/users/:id/` | Update user role or mute |

---

## 12. Rules Engine — How It Works

**File:** `backend/governance/services.py` — `RulesService`

The Rules Engine is the heart of Civitas. Every action that creates content is evaluated against a rule pipeline before it is saved.

### Pipeline Steps

```
User attempts action (e.g. CREATE_DISCUSSION)
         │
         ▼
Step 0: Mute Check
  Is the user currently muted?
  ├─ YES → Return BLOCKED immediately
  └─ NO → Continue
         │
         ▼
Step 1: Resolve Scope Chain
  Build a chain of all contexts:
  e.g. DISCUSSION → SUB_BOARD → BOARD → COMMUNITY → PLATFORM
  Uses select_related() for a single optimized DB query
         │
         ▼
Step 2: Fetch Applicable Rules
  Query: Rule WHERE scope matches chain AND action matches AND role matches AND active=True
         │
         ▼
  No matching rules? → Return ALLOWED immediately
         │
         ▼
Step 3: Evaluate Constitutional Rules first (is_system=True)
  These rules ALWAYS win over everything else
  If any constitutional rule blocks → Return BLOCKED immediately
         │
         ▼
Step 4: Evaluate Community/Configurable Rules
  Sorted by scope specificity (Discussion > Sub-Board > Board > Community > Platform)
  More specific rules overrides less specific
  First blocking rule wins → Return BLOCKED
         │
         ▼
Step 5: All rules passed → Return ALLOWED
         │
         ▼
Log the decision to RuleDecision table (always)
```

### Conditions the Engine Can Check

| Condition Key | What it does |
|---------------|-------------|
| `max_per_day` | Count how many ALLOWED decisions user has for this action today; block if limit reached |
| `max_per_hour` | Same as above but per hour |
| `requires_sources` | Block if `sources` field is empty in payload |
| `requires_reason` | Block if `reason` field is empty |
| `max_reports` | Block if pending report count for the target content exceeds threshold |
| `member_age` | Only applies rule to `new` (< 30 days) or `established` (≥ 30 days) members |
| Content term scanning | Scans content against `BoardTypeTerm.DISALLOWED` terms for the board's type |

### Scope Priority (Specificity)

```
DISCUSSION    = 5  (most specific)
SUB_BOARD     = 4
BOARD         = 3
COMMUNITY     = 2
PLATFORM      = 1  (least specific)
```

A rule at `DISCUSSION` scope will override a rule at `PLATFORM` scope if both apply.

### Where Rules Are Evaluated

Rules are evaluated in these ViewSet endpoints:
- `DiscussionViewSet.create()` — action: `CREATE_DISCUSSION`
- `ResponseViewSet.create()` — action: `RESPOND` / `ENDORSE` / `CHALLENGE` / `CLARIFY` (mapped from `Response.type`)

---

## 13. Reputation System

**File:** `backend/governance/services.py` — `ReputationService`

### Starting Score
All users start with `reputation_score = 100`.

### Reputation Changes

| Event | Delta |
|-------|-------|
| Moderation action `REMOVE` issued against user | -10 |
| Moderation action `WARN`/`RESTRICT`/`MUTE` issued | -5 |
| Appeal filed and **rejected** (frivolous appeal penalty) | -5 |
| Appeal filed and **approved** (wrongful moderation) | +10 |
| Content reaches **10+ upvotes** (one-time bonus) | +5 |

### Auto-Mute Trigger

If `reputation_score` drops to **≤ 0**:
1. `is_muted = True`
2. `mute_until = now + 24 hours`
3. A notification is sent to the user: "Your reputation score has reached zero. You have been temporarily muted for 24 hours."
4. This is logged as `AUDIT [AUTO_MUTE]`.

### Mute Expiry

When the Rules Engine evaluates an action for a muted user:
- If `now >= mute_until`, the mute is **automatically cleared** (`is_muted = False`, `mute_until = None`).
- The user's action is then evaluated normally.

---

## 14. Governance Trigger Service

**File:** `backend/governance/services.py` — `GovernanceTriggerService`

This service runs automatically every time a vote is cast (`VoteViewSet.perform_create()`).

### Trigger 1: Auto-Flag (High Downvotes)

When a piece of content reaches **≥ 5 downvotes**:
- The system automatically creates a `Report` record with `reporter = system_user` (the SYSTEM role user).
- Reason: `"System generated: High negative sentiment (N downvotes)."`
- This report appears in the facilitator's moderation queue.
- The auto-flag is only created once (deduped by `reporter__role='SYSTEM'` check).

### Trigger 2: Reputation Bonus (High Upvotes)

When content reaches **≥ 10 upvotes**:
- The content's author receives `+5` reputation.
- This bonus is **only granted once per piece of content** (tracked via a special `RuleDecision` entry with reason starting `'Content quality bonus'`).

---

## 15. Notification & Signal System

**File:** `backend/governance/signals.py`

Django signals create notifications automatically whenever specific model events occur.

### `post_save` on Discussion (new post created)

1. All users **following the sub-board** get notified: "New Post in [Sub-Board Name]"
2. All users **following the parent board** get notified: "New Activity in [Board Name]"
3. The discussion author is excluded from receiving their own notifications.

### `post_save` on Response (new reply created)

1. The **discussion author** gets notified: "New Reply to your thread"
2. All users **following the sub-board** get notified: "New Contribution in [Sub-Board Name]"
3. Deduplication: the reply author and discussion author don't get duplicate notifications.

### `post_save` on Follow (user follows a board/sub-board)

All **facilitators of the community** containing that board get notified:
- "New Follower Activity — Member [username] started following [Board/Sub-Board Name]"

### `post_delete` on Follow (user unfollows)

All **facilitators** get notified:
- "Follower Reduction Alert — Member [username] stopped following [Board/Sub-Board Name]"

---

## 16. System Rules (SR) — Constitutional Layer

System Rules (`is_system=True` on the `Rule` model) are **constitutional rules** created by the platform. They cannot be overridden by any community rule. They are evaluated first and their decision is final.

| Rule Code | Title | Enforcement |
|-----------|-------|-------------|
| **SR-8** | No Silent Moderation | Every moderation action must state which rule was violated and provide a written reason. Enforced at the `ModerationActionViewSet` serializer level. |
| **SR-9** | Content Integrity | Facilitators are prohibited from editing member-authored discussions or responses. Enforced in `DiscussionViewSet.update()` and `ResponseViewSet.update()`. |
| **SR-12** | Secure Invite System | Invite communities cannot be joined without a valid, unexpired, unused invite code. Enforced in `CommunityViewSet.join()`. |
| **SR-15** | Rate Abuse Protection | No user may exceed a configured maximum number of actions per day or per hour. Enforced via `max_per_day` and `max_per_hour` conditions in the Rules Engine. |
| **SR-18** | Structured Posting | Rules with `requires_sources: true` enforce mandatory citation for evidence-type posts. |
| **SR-22** | Right to Appeal | Every moderation action can be formally contested. Facilitators must review and issue a decision with a written reason. Enforced via the `AppealViewSet` and its `decide` action. |

---

## 17. Security & Authentication Infrastructure

### JWT Token Authentication
- **Library:** `djangorestframework-simplejwt`
- **Access token lifetime:** 60 minutes
- **Refresh token lifetime:** 1 day
- Tokens stored in `localStorage` with keys `civitas_token` and `civitas_refresh`.
- Axios interceptor automatically refreshes expired access tokens.

### Custom Auth Backend
`governance/authentication.py` implements `EmailOrUsernameModelBackend`, allowing sign-in via either email address or username.

### UUID Primary Keys
All models use `UUID v4` primary keys instead of sequential integers. This prevents:
- ID enumeration attacks (guessing user IDs)
- Data leakage through predictable ID patterns

### CORS
Configured via `django-cors-headers`. `CORS_ALLOWED_ORIGINS` is set from environment variables, restricting which frontend origins can make API calls.

### Rate Limiting
DRF's built-in throttle classes:
- Anonymous users: 100 requests/day
- Authenticated users: 1000 requests/day

### Permission Classes

| Class | Used By | Access |
|-------|---------|--------|
| `IsAuthenticated` | Most ViewSets | Any logged-in user |
| `AllowAny` | `register`, JWT endpoints | Public |
| `IsSystemAdmin` | All `/admin/` views | `role == 'SYSTEM'` or `is_superuser` |

### Audit Logging
All sensitive operations are logged via Python's `logging` module to:
1. Console (stdout)
2. `backend/logs/audit.log` file (verbose format with timestamp and process ID)

The logger is named `governance.audit` and captures events like:  
`USER_REGISTER`, `ORIENTATION_COMPLETE`, `ROLE_UPGRADE`, `ROLE_CHANGE`, `MEMBER_SUSPEND`, `MEMBER_KICK`, `MODERATION_ACTION`, `APPEAL_APPROVED`, `APPEAL_REJECTED`, `APPEAL_REVERSAL`, `AUTO_MUTE`, `AUTO_FLAG`, `VOTE_CAST`, `VOTE_SWITCH`, `VOTE_REMOVED`, `REPUTATION_CHANGE`, `ADMIN_USER_UPDATE`

---

## 18. Containerisation & Deployment

### Docker Compose (Development/Staging)

**File:** `docker-compose.yml`

Three services:
1. **backend** — Django server on port 8000
2. **frontend** — Vite dev server / Nginx on port 80
3. **nginx** — Reverse proxy routing `/api/` to backend, `/` to frontend

### Kubernetes (Production)

**Directory:** `k8s/`

Kubernetes manifests for production deployment:
- Deployment specs for frontend and backend
- Service definitions
- ConfigMaps for environment variables
- Ingress configuration

### Nginx Config (`nginx.conf`)

- `/` → serves `dist/index.html` (the built React SPA)
- `/api/` → proxied to Django backend
- `/media/` → serves uploaded files (avatars, images)
- All non-matching routes → fall back to `index.html` (enabling client-side routing)

### Backend Dockerfile

- Based on Python image
- Installs requirements from `requirements.txt`
- Runs `python manage.py migrate` on startup
- Starts Django development server bound to `0.0.0.0:8000`

### Environment Variables

Key backend env vars (stored in `backend/.env`):

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | True/False |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hosts |
| `DATABASE_URL` | Database connection string (defaults to SQLite) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |

---

## 19. Audit Logging

Every critical platform action produces an audit log entry in two places:
1. **`governance.audit` Python logger** → console + `logs/audit.log` file
2. **`RuleDecision` database records** → queryable via `/api/audit-logs/`

The audit log is a core governance feature. It fuels:
- The **Security Context** page for facilitators (displaying all BLOCKED actions).
- The **Admin Moderation Page** for the super admin.
- The **Moderation History** page for members (their own records only).
- The **Super Admin Dashboard** block rate calculation.

---

## 20. Community Templates

When a facilitator creates a community, they select a template that defines the initial board structure. All communities receive an **Announcements** board automatically.

### GENERAL Template
```
📋 Announcements
📌 General
```

### TECHNICAL Template
```
📋 Announcements
💻 Dev-Log
🐛 Bug-Tracker
🔧 Technical-Discussion
```

### CIVIC Template
```
📋 Announcements
📜 Constitutional-Drafting
🗣️ Public-Forum
⚖️ Legal-Review
```

### RESEARCH Template
```
📋 Announcements
🔬 Hypothesis-Testing
📊 Data-Review
📄 White-Papers
```

Each template pairs with a recommended `BoardType` (TECHNICAL, CIVIC_DIALOGUE, RESEARCH, GENERAL) to enable context-aware moderation — different term dictionaries, tone guidelines, and citation requirements per board type.

---

*Documentation generated by Antigravity from full codebase analysis. All information reflects the actual implementation as of April 20, 2026.*
