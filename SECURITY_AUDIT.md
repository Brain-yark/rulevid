# SVSM Security Audit

**Assessment date:** 2026-08-29  
**Scope:** Backend REST API, Socket.IO service, Prisma schema, payment integrations, dependency manifests, and repository configuration.  
**Method:** Local source review, repository tracking checks, and `npm audit --omit=dev` for backend and frontend dependencies.

This document records findings identified during the audit. No source files were modified as part of the assessment.

## Executive Summary

The application is not ready for public production exposure until the critical and high-severity findings are addressed. The highest-risk issues are the public super-admin bootstrap endpoint, insufficient authorization around sessions and payment verification, unauthenticated Socket.IO operations, and exposed credential material in the workspace.

## Findings

### SEC-001: Public super-admin bootstrap endpoint

**Severity:** Critical  
**Affected code:** `backend/src/routes/adminRoute.ts`, `backend/src/controllers/adminController.ts`

`POST /api/v1/admin/seed-superadmin` is registered before authentication and calls `ensureSuperAdmin()`. The handler returns a fixed email, password, and `super_admin` role. The startup routine also creates or promotes that account with the same fixed credentials.

**Impact:** Any network client that can reach the API can obtain administrator credentials and take control of the platform, including users, roles, billing packages, and financial records.

**Remediation:** Remove the public endpoint. Use a one-time, deployment-controlled bootstrap process or an out-of-band secret. Remove hard-coded credentials and rotate the account immediately. Add tests proving the endpoint is unavailable after initialization.

### SEC-002: Any authenticated user can join arbitrary sessions

**Severity:** High  
**Affected code:** `backend/src/routes/sessionRoute.ts`, `backend/src/controllers/sessionController.ts`

`POST /api/v1/sessions/:id/join` and `POST /api/v1/sessions/:id/refresh-token` require only a valid JWT. The handlers do not verify that the caller is the facilitator, has an event ticket, or otherwise has entitlement to the session. They issue an Agora publisher token and chat credentials.

**Impact:** A logged-in user can enter private sessions, publish audio/video, participate in chat, refresh access, and trigger recording-side effects.

**Remediation:** Enforce ownership or ticket entitlement before issuing any token. Use subscriber tokens for attendees where appropriate. Apply the same authorization policy to join, refresh, and Socket.IO presence operations.

### SEC-003: Socket.IO has no authentication or authorization

**Severity:** High  
**Affected code:** `backend/src/services/socketService.ts`

Clients can call `register_user` with any user ID, join any session room, leave rooms, and send messages with an arbitrary claimed username. No JWT handshake authentication, session entitlement check, payload schema, message length limit, or event rate limit is present.

**Impact:** Attackers can receive user-targeted notifications, impersonate users in chat, enumerate/join rooms, and consume server resources.

**Remediation:** Authenticate the Socket.IO handshake, derive the user ID from the verified token, authorize session membership server-side, validate payloads with Zod, cap message size, and rate-limit room/message events.

### SEC-004: Stripe verification permits cross-user fulfillment and replay

**Severity:** High  
**Affected code:** `backend/src/routes/billingRoute.ts`

`POST /api/v1/billing/verify-session` retrieves a Stripe Checkout session and checks only `payment_status`. It does not compare the session metadata `userId` with the authenticated caller. Ticket fulfillment by `ticketId` does not verify ticket ownership. There is no idempotency check before applying package minutes, marking tickets paid, or creating transactions.

**Impact:** A user who obtains another valid Checkout Session ID may fulfill another user's purchase or alter ticket access. Repeated verification can duplicate package transactions and repeatedly reset package minutes.

**Remediation:** Require `session.metadata.userId === req.user.userId`; verify the event, ticket, and user relationship; validate expected amount and currency; and make fulfillment idempotent using the Stripe event/session/payment identifiers. Prefer the signed webhook as the sole fulfillment mechanism.

### SEC-005: Client-controlled Stripe PaymentMethod is stored without ownership validation

**Severity:** High  
**Affected code:** `backend/src/routes/billingRoute.ts`, `backend/src/services/billingService.ts`

The payment-method endpoint stores any client-provided Stripe PaymentMethod ID. The service later charges the stored ID using the current user's Stripe customer without first verifying that the PaymentMethod belongs to that customer.

**Impact:** Incorrect payment-method association, unexpected charges, billing abuse, or payment failures. The risk is especially serious for automatic overage charging.

**Remediation:** Retrieve the PaymentMethod from Stripe and verify its customer association. Attach it only through a verified SetupIntent for the authenticated customer. Never treat a client-supplied ID as proof of ownership.

### SEC-006: Credentials and private key material are present in the workspace

**Severity:** High  
**Affected files:** `.env`, `backend/.env`, `rsa_key_literal.txt`, `rsa_key.txt`, and related key files

The workspace contains database credentials, a JWT secret, Agora credentials, Stripe secret-key material, and a private RSA key. The files were not returned by `git ls-files` in this workspace and are ignored by Git, but they remain accessible on the machine and could be copied or accidentally committed.

**Impact:** Credential theft could allow database access, JWT forgery, Agora administration, Stripe API access, or use of the private key.

**Remediation:** Rotate every credential immediately, remove private key material from the workspace, use a secret manager, add secret scanning to CI, and verify that no historical Git objects or artifacts contain the secrets.

### SEC-007: Vulnerable production dependency chain

**Severity:** High  
**Affected packages:** Backend and frontend dependency trees

`npm audit --omit=dev` reported five vulnerabilities in the installed production dependency chain, including Axios, `form-data`, `socket.io-parser`, and `ws`. Reported impacts include prototype-pollution request manipulation, credential/request hijacking conditions, memory exhaustion, and denial of service. The frontend inherits vulnerable Axios and Socket.IO transitive packages as well.

**Remediation:** Upgrade the affected packages and lockfiles, review the resulting dependency tree, and run the application test/build checks. Do not suppress the audit without documenting an accepted risk.

### SEC-008: JWT fallback secret enables token forgery after misconfiguration

**Severity:** Medium  
**Affected code:** `backend/src/middleware/authMiddleware.ts`, `backend/src/controllers/authController.ts`

If `JWT_SECRET` is missing, both authentication paths use the literal `fallback_secret_key`.

**Impact:** A deployment with a missing environment variable allows attackers who know the fallback value to forge JWTs and select claims such as user ID and role.

**Remediation:** Fail application startup when required secrets are absent or weak. Remove all fallback signing keys and add configuration validation tests.

### SEC-009: CORS accepts arbitrary origins with credentials enabled

**Severity:** Medium  
**Affected code:** `backend/src/index.ts`

The CORS validator ultimately calls `callback(null, true)` for every origin, while `credentials: true` is enabled for REST and Socket.IO.

**Impact:** This creates a broad cross-origin trust boundary and becomes dangerous if browser-managed credentials or cookies are introduced. It also weakens protection against malicious web origins.

**Remediation:** In production, allow only an explicit origin allowlist. Enable credentials only when required and test the allowed-origin behavior.

### SEC-010: Unbounded request and WebSocket payloads

**Severity:** Medium  
**Affected code:** `backend/src/index.ts`, `backend/src/services/socketService.ts`

The global JSON parser has no explicit body-size limit. Socket.IO messages are not schema-validated or length-limited, and message events have no rate limit.

**Impact:** Oversized requests and message floods can consume memory or CPU and degrade availability.

**Remediation:** Set conservative JSON and URL-encoded body limits, validate all Socket.IO payloads, cap text length, configure Socket.IO transport/message limits, and rate-limit abusive clients.

### SEC-011: Internal error details are returned to clients

**Severity:** Low/Medium  
**Affected code:** `backend/src/controllers/authController.ts`, `backend/src/controllers/eventController.ts`, and other handlers

Several error responses include `error.message` in the response body. Provider, database, and implementation errors can therefore be exposed to callers.

**Impact:** Information disclosure that assists exploitation and may reveal sensitive integration or database details.

**Remediation:** Return stable generic error messages in all environments exposed to users. Keep detailed errors in structured server logs with appropriate redaction.

## Recommended Remediation Order

1. Disable the public super-admin bootstrap endpoint and rotate all exposed credentials.
2. Fix session, Socket.IO, and payment authorization/idempotency controls.
3. Upgrade vulnerable dependencies and rebuild both dependency trees.
4. Make startup fail closed on missing secrets; restrict CORS and request sizes.
5. Add security regression tests for every finding and run them in CI.

## Verification Checklist

- [ ] Unauthenticated requests cannot bootstrap or enumerate administrator access.
- [ ] Session join and token refresh require facilitator ownership or valid ticket entitlement.
- [ ] Socket.IO handshake identity is verified and room/message authorization is enforced.
- [ ] Stripe fulfillment binds the session to the authenticated user and is idempotent.
- [ ] Stripe PaymentMethods are verified against the authenticated customer.
- [ ] All exposed credentials and keys have been rotated and removed from local artifacts.
- [ ] `npm audit --omit=dev` reports no unresolved production vulnerabilities, or exceptions are documented.
- [ ] Production startup fails when required secrets are missing.
- [ ] CORS, body-size, WebSocket payload, and rate-limit tests pass.
