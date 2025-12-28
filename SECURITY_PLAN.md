# CallMap Analytics - Security Hardening Plan

**Last Updated:** 2025-01-15  
**Status:** In Progress

## Overview

This document outlines the security hardening project for the CallMap Analytics platform. The goal is to implement modern security standards and best practices without breaking existing functionality.

---

## Security Surface Mapping

### Main Entry Points

1. **Authentication Flow**
   - `/api/auth/login` - Firebase ID token exchange for session cookie
   - `/api/auth/logout` - Session termination
   - `/api/auth/session` - Session validation
   - `/api/auth/mfa/*` - Multi-factor authentication
   - Client-side: Firebase Auth SDK for sign-in

2. **Admin & Analytics Routes** (Require admin/superAdmin)
   - `/api/admin/*` - Admin operations (set role, revoke access, wallet adjustments)
   - `/api/analytics/*` - Analytics queries (100+ endpoints)
   - `/api/ai/*` - AI-powered features (explain page, copilot)
   - `/api/admin/ai-agents/*` - AI Agents system
   - `/api/monitoring/*` - Real-time monitoring
   - `/api/insights/*` - Insights generation
   - `/api/reports/*` - Report generation
   - `/api/dashboards/*` - Custom dashboards
   - `/api/support/*` - Support error system

3. **User & Team Management**
   - `/api/users/*` - User CRUD operations
   - `/api/teams/*` - Team/workspace management
   - `/api/billing/*` - Billing and revenue data

4. **Data Export Routes**
   - Various analytics endpoints that return CSV/Excel exports
   - Report generation endpoints

### Sensitive Data Types

- **User Data:** Email, UIDs, roles, token balances, session data
- **Analytics Data:** Usage metrics, revenue data, user behavior
- **AI Logs:** Prompts, responses, agent interactions
- **Error Data:** Stack traces, user context, system state
- **Billing Data:** Subscription info, payment data, invoices

### High-Value Targets

1. **Admin Panels**
   - `/admin/ai-agents` - AI-powered decision making
   - `/admin/manage-access` - Access control management
   - `/support/errors` - Error intelligence system

2. **AI Agents Page**
   - Access to full database for analytics queries
   - Prompt generation for Cursor
   - Export capabilities

3. **Export Endpoints**
   - Data export routes that could leak sensitive information
   - Report generation

---

## Current Security Posture

### ✅ Strengths

1. **Authentication**
   - Firebase session cookies with HttpOnly, Secure, SameSite=strict
   - MFA support (mandatory for admins)
   - Rate limiting on login (3 attempts per 15 minutes)
   - Session expiration (8 hours)

2. **Authorization**
   - Role-based access control (superAdmin, admin, user)
   - Most admin routes check for admin/superAdmin role
   - Middleware protection for protected routes

3. **Input Validation**
   - Zod schemas for some routes (`userUpdateSchema`, etc.)
   - Request body size validation
   - Search query validation

4. **Security Headers**
   - CSP headers in middleware
   - X-Frame-Options, X-Content-Type-Options
   - HSTS in production
   - Referrer-Policy

5. **CSRF Protection**
   - CSRF token generation endpoint
   - CSRF secret stored in HttpOnly cookie
   - Wallet adjustment uses CSRF tokens

### ⚠️ Areas for Improvement

1. **Centralized RBAC**
   - Role checks are scattered across routes
   - No single source of truth for permissions
   - Inconsistent role checking patterns

2. **Rate Limiting**
   - Only login endpoint has rate limiting
   - No rate limits on AI endpoints, exports, or admin operations
   - No IP-based or user-based limits on sensitive operations

3. **Input Validation**
   - Not all routes use Zod validation
   - Some routes accept arbitrary JSON without validation
   - Query parameters not always validated

4. **Security Logging**
   - No centralized security event logging
   - Failed logins not logged
   - Permission denials not tracked
   - No suspicious pattern detection

5. **AI Security**
   - No prompt injection prevention
   - Secrets not redacted before sending to LLMs
   - No rate limiting on AI calls

6. **Error Handling**
   - Some error messages may leak internal details
   - Stack traces not always sanitized

7. **Secrets Management**
   - Need to audit for hardcoded secrets
   - Environment variable usage needs review

---

## Implementation Plan

### Phase 1: Centralized RBAC ✅ (In Progress)

**Goal:** Create a single source of truth for permissions and apply consistently.

**Tasks:**
1. Create `lib/auth/permissions.ts` with:
   - `requireAuth()` - Verify session
   - `requireAdmin()` - Require admin or superAdmin
   - `requireSuperAdmin()` - Require superAdmin only
   - `requireRole(role)` - Require specific role
   - `checkPermission(resource, action)` - Resource-based permissions

2. Replace scattered role checks with centralized helpers
3. Apply to all `/api/admin/*`, `/api/analytics/*`, `/api/ai/*` routes

**Files to Update:**
- All routes in `/app/api/admin/*`
- All routes in `/app/api/analytics/*`
- All routes in `/app/api/ai/*`
- All routes in `/app/api/monitoring/*`
- All routes in `/app/api/insights/*`
- All routes in `/app/api/reports/*`
- All routes in `/app/api/dashboards/*`
- All routes in `/app/api/support/*`

### Phase 2: Rate Limiting

**Goal:** Prevent abuse and brute force attacks.

**Tasks:**
1. Extend existing rate limiting to:
   - AI endpoints (10 requests per minute per user)
   - Export endpoints (5 exports per hour per user)
   - Admin operations (20 requests per minute per user)
   - Analytics queries (30 requests per minute per user)

2. Implement IP-based rate limiting for:
   - Login attempts (already done)
   - Failed authentication attempts

3. Add account lockout after repeated failed attempts

**Files to Update:**
- `lib/auth/rate-limit-kv.ts` (extend existing)
- All AI routes
- All export routes
- All admin routes

### Phase 3: Input Validation

**Goal:** Validate all inputs with Zod schemas.

**Tasks:**
1. Create Zod schemas for:
   - All API request bodies
   - Query parameters
   - Path parameters
   - Headers (where applicable)

2. Apply validation to all routes
3. Reject unknown fields with `.strict()`
4. Sanitize user input before rendering

**Files to Update:**
- `lib/schemas.ts` (extend existing)
- All API routes

### Phase 4: Security Logging

**Goal:** Track security-relevant events.

**Tasks:**
1. Create `lib/auth/security-log.ts` for:
   - Failed login attempts
   - Permission denials
   - Suspicious patterns (rapid requests, unusual exports)
   - Role changes
   - Wallet adjustments

2. Log to Firestore collection `security_events`
3. Never log secrets or full tokens
4. Include IP, user ID, timestamp, action, result

**Files to Create:**
- `lib/auth/security-log.ts`

**Files to Update:**
- All auth routes
- All admin routes
- All routes with permission checks

### Phase 5: AI Security

**Goal:** Secure AI interactions and prevent prompt injection.

**Tasks:**
1. Redact secrets before sending to LLMs:
   - API keys
   - Tokens
   - Internal IDs
   - User emails (where not needed)

2. Prevent prompt injection:
   - Validate user input
   - Escape special characters
   - Use system prompts that ignore user role instructions

3. Rate limit AI calls per user
4. Log all AI interactions

**Files to Update:**
- `app/api/admin/ai-agents/route.ts`
- `app/api/ai/explain-page/route.ts`
- `app/api/analytics/copilot/route.ts`
- `app/api/insights/generate/route.ts`

### Phase 6: CSRF Protection

**Goal:** Strengthen CSRF protection.

**Tasks:**
1. Verify CSRF tokens on all mutation endpoints
2. Use SameSite=strict cookies (already done)
3. Add CSRF token validation helper
4. Apply to all POST/PUT/DELETE routes

**Files to Update:**
- All mutation routes
- `lib/auth/csrf.ts` (create if needed)

### Phase 7: Secrets Audit

**Goal:** Ensure no hardcoded secrets.

**Tasks:**
1. Search codebase for:
   - Hardcoded API keys
   - Hardcoded tokens
   - Hardcoded project IDs
   - Hardcoded secrets

2. Move all to environment variables
3. Verify `.env*` files are in `.gitignore`
4. Document required environment variables

**Files to Review:**
- All source files
- Configuration files
- `.env.example` (create if needed)

### Phase 8: Security Headers

**Goal:** Improve security headers.

**Tasks:**
1. Review and tighten CSP
2. Add missing security headers
3. Test headers in production

**Files to Update:**
- `middleware.ts`

### Phase 9: Error Handling

**Goal:** Prevent information leakage.

**Tasks:**
1. Sanitize error messages in production
2. Never expose stack traces to clients
3. Log detailed errors server-side only
4. Return generic error messages to clients

**Files to Update:**
- All API routes
- Error handling utilities

### Phase 10: Dependency Audit

**Goal:** Ensure dependencies are secure.

**Tasks:**
1. Run `npm audit`
2. Update vulnerable packages
3. Remove unused dependencies
4. Document dependency review process

---

## Secrets Inventory

### Current Secrets (Environment Variables)

1. **Firebase**
   - `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin SDK credentials
   - `FIREBASE_SERVICE_ACCOUNT_PATH` - Alternative to KEY (path to file)
   - `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase Client SDK (public)
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase Auth domain (public)
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID (public)

2. **OpenAI**
   - `OPENAI_API_KEY` - OpenAI API key for AI features
   - `OPENAI_MODEL` - Model to use (defaults to gpt-4o-mini)

3. **CSRF**
   - CSRF secrets generated dynamically (stored in HttpOnly cookies)

4. **Cron Jobs**
   - `CRON_SECRET` - Secret for cron job authentication

### Secret Usage

- **Firebase Admin SDK:** Server-side only, never exposed to client
- **Firebase Client SDK:** Public keys, safe to expose
- **OpenAI API Key:** Server-side only, used in API routes
- **CSRF Secrets:** Stored in HttpOnly cookies, server-side validation
- **Cron Secret:** Used to authenticate background jobs

### Secret Rotation

- **Firebase Service Account:** Rotate via Firebase Console, update env var
- **OpenAI API Key:** Rotate via OpenAI dashboard, update env var
- **CSRF Secrets:** Auto-rotated on each login
- **Cron Secret:** Manual rotation, update env var and cron job config

---

## OWASP Top 10 (2021) Compliance

### A01:2021 – Broken Access Control
- ✅ Role-based access control implemented
- ⚠️ Need centralized permission checks
- ⚠️ Need to verify horizontal privilege escalation prevention

### A02:2021 – Cryptographic Failures
- ✅ Session cookies use secure flags
- ✅ HTTPS enforced in production
- ⚠️ Need to verify sensitive data encryption at rest

### A03:2021 – Injection
- ✅ Using parameterized queries (Firestore)
- ✅ Zod validation on some routes
- ⚠️ Need validation on all routes
- ⚠️ Need prompt injection prevention for AI

### A04:2021 – Insecure Design
- ✅ MFA required for admins
- ✅ Rate limiting on login
- ⚠️ Need threat modeling for new features

### A05:2021 – Security Misconfiguration
- ✅ Security headers in middleware
- ⚠️ Need to review default configurations
- ⚠️ Need to ensure error messages don't leak info

### A06:2021 – Vulnerable Components
- ⚠️ Need dependency audit
- ⚠️ Need automated security updates

### A07:2021 – Authentication Failures
- ✅ Strong session management
- ✅ MFA support
- ✅ Rate limiting on login
- ⚠️ Need account lockout after repeated failures

### A08:2021 – Software and Data Integrity
- ⚠️ Need dependency verification
- ⚠️ Need CI/CD security checks

### A09:2021 – Security Logging Failures
- ⚠️ Need centralized security logging
- ⚠️ Need failed login tracking
- ⚠️ Need permission denial logging

### A10:2021 – Server-Side Request Forgery (SSRF)
- ✅ No direct user-controlled URLs
- ⚠️ Need to verify all external requests are safe

---

## Incident Response

### If Security Incident Suspected

1. **Immediate Actions:**
   - Review security logs in Firestore `security_events` collection
   - Check for unusual patterns:
     - Multiple failed logins from same IP
     - Permission denials for admin routes
     - Unusual export volumes
     - Rapid API calls from single user
   - Review recent role changes
   - Check wallet adjustment logs

2. **Logs Location:**
   - Firestore: `security_events` collection
   - Server logs: Vercel logs (if deployed)
   - Error tracking: Support error system

3. **Investigation Steps:**
   - Identify affected users/workspaces
   - Review audit logs for affected resources
   - Check for data exfiltration
   - Verify no unauthorized role changes
   - Review AI interaction logs

4. **Remediation:**
   - Revoke affected sessions
   - Reset compromised credentials
   - Rotate secrets if exposed
   - Update security controls
   - Notify affected users (if required)

---

## Testing

### Security Tests Needed

1. **Unit Tests:**
   - Permission helper functions
   - Input validation schemas
   - Rate limiting logic

2. **Integration Tests:**
   - Admin route access control
   - Role-based access enforcement
   - CSRF protection
   - Rate limiting behavior

3. **Manual Testing:**
   - Attempt unauthorized access
   - Test rate limits
   - Verify error message sanitization
   - Test CSRF protection

---

## Dependencies Review

### Security-Sensitive Dependencies

1. **firebase-admin** - Firebase Admin SDK
2. **firebase** - Firebase Client SDK
3. **openai** - OpenAI API client
4. **zod** - Input validation
5. **csrf** - CSRF token generation

### Review Checklist

- [ ] Run `npm audit` regularly
- [ ] Update dependencies monthly
- [ ] Review changelogs for security fixes
- [ ] Test after dependency updates
- [ ] Pin critical dependency versions

---

## Progress Tracking

- [x] Security surface mapping
- [x] Security plan creation
- [ ] Phase 1: Centralized RBAC
- [ ] Phase 2: Rate limiting
- [ ] Phase 3: Input validation
- [ ] Phase 4: Security logging
- [ ] Phase 5: AI security
- [ ] Phase 6: CSRF protection
- [ ] Phase 7: Secrets audit
- [ ] Phase 8: Security headers
- [ ] Phase 9: Error handling
- [ ] Phase 10: Dependency audit

---

*This document is a living document and should be updated as security improvements are implemented.*

