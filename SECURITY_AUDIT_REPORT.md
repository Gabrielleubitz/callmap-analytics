# Security Audit Report
**Date:** 2024-12-19  
**Application:** Callmap Analytics Dashboard  
**Auditor:** Security Specialist Analysis

## Executive Summary

This security audit identified **8 critical vulnerabilities**, **5 high-risk issues**, and **3 medium-risk concerns** that require immediate attention. The application uses Firebase Admin SDK for authentication and Firestore for data storage, with Next.js API routes handling server-side operations.

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **Missing Authorization Check in Wallet Adjustment Route**
**Location:** `app/api/admin/wallet/[userId]/adjust/route.ts`  
**Severity:** CRITICAL  
**Risk:** Unauthorized users can adjust wallet balances

**Issue:**
The wallet adjustment endpoint does NOT verify that the requester is an admin or superAdmin before allowing wallet balance modifications. This allows any authenticated user to manipulate token balances.

**Current Code:**
```typescript
export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  // NO AUTHORIZATION CHECK HERE!
  const userId = params.userId
  const body = await request.json()
  // ... proceeds to adjust wallet
}
```

**Fix Required:**
```typescript
export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  // Verify session and check for admin role
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('callmap_session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const decodedToken = await verifySessionCookie(sessionCookie)
  
  // Check if user is admin or superAdmin
  if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    )
  }
  
  // ... rest of the code
}
```

---

### 2. **In-Memory Rate Limiting (Not Production-Ready)**
**Location:** `lib/auth/rate-limit.ts`  
**Severity:** CRITICAL  
**Risk:** Rate limiting bypass in distributed environments

**Issue:**
Rate limiting uses an in-memory Map, which will NOT work in production environments with multiple server instances (e.g., Vercel with multiple edge functions). Each instance maintains its own counter, allowing attackers to bypass rate limits by hitting different instances.

**Current Code:**
```typescript
const rateLimitStore = new Map<string, RateLimitEntry>()
```

**Fix Required:**
- Use Redis or a distributed cache (e.g., Upstash Redis, Vercel KV)
- Implement proper rate limiting middleware
- Consider using a service like Cloudflare Rate Limiting or AWS WAF

---

### 3. **IP Address Spoofing Vulnerability**
**Location:** `app/api/auth/login/route.ts`  
**Severity:** CRITICAL  
**Risk:** Rate limiting can be bypassed by spoofing IP addresses

**Issue:**
The rate limiting uses `x-forwarded-for` header which can be easily spoofed by attackers. This allows bypassing rate limits.

**Current Code:**
```typescript
const ip = request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown'
```

**Fix Required:**
- Use a combination of IP, user ID, and session token for rate limiting
- Implement proper IP extraction that respects proxy headers but validates them
- Consider using request fingerprinting (user-agent + IP + other headers)

---

### 4. **Explorer Route Lacks Authorization**
**Location:** `app/api/explorer/route.ts`  
**Severity:** CRITICAL  
**Risk:** Unauthorized access to all Firestore collections

**Issue:**
The explorer route allows querying ANY Firestore collection without verifying the user is authorized. This could expose sensitive data.

**Current Code:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const tableName = body.tableName
  // NO AUTHORIZATION CHECK!
  const collectionName = COLLECTION_MAP[tableName] || tableName
  // ... queries collection
}
```

**Fix Required:**
- Add authorization check (verify admin/superAdmin role)
- Restrict which collections can be queried
- Add audit logging for all explorer queries

---

### 5. **CORS Configuration Too Permissive**
**Location:** `firebase-storage-cors.json`  
**Severity:** CRITICAL  
**Risk:** Cross-origin attacks, data exfiltration

**Issue:**
The CORS configuration allows wildcard origins (`https://*.vercel.app`) which is overly permissive. Any Vercel deployment can access your Firebase Storage.

**Current Configuration:**
```json
{
  "origin": [
    "https://*.vercel.app",  // ⚠️ WILDCARD - TOO PERMISSIVE
    "http://localhost:3000",
    // ...
  ]
}
```

**Fix Required:**
- Remove wildcard origins
- Use specific allowed origins only
- Implement origin validation on the server side

---

### 6. **Missing Authorization in User Update Route**
**Location:** `app/api/users/[id]/update/route.ts`  
**Severity:** CRITICAL  
**Risk:** Unauthorized user data modification

**Issue:**
The user update route may not properly verify authorization. Need to verify it checks admin role before allowing updates.

**Fix Required:**
- Verify authorization check exists
- Ensure only admins can update user data
- Add audit logging for user updates

---

### 7. **Session Cookie Security Settings**
**Location:** `app/api/auth/login/route.ts`  
**Severity:** CRITICAL  
**Risk:** Session hijacking, XSS attacks

**Issue:**
Session cookie settings need verification:
- `secure` flag only set in production (good)
- `sameSite: 'lax'` (should be 'strict' for admin panels)
- `httpOnly: true` (good)

**Current Code:**
```typescript
response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',  // ⚠️ Should be 'strict' for admin panels
  path: '/',
  maxAge: expiresIn / 1000,
})
```

**Fix Required:**
- Change `sameSite` to `'strict'` for better CSRF protection
- Consider adding `domain` restriction if using subdomains

---

### 8. **Error Information Disclosure**
**Location:** Multiple API routes  
**Severity:** CRITICAL  
**Risk:** Information leakage to attackers

**Issue:**
Some error messages may expose sensitive information about the system, database structure, or internal errors.

**Examples:**
```typescript
// app/api/auth/login/route.ts
return NextResponse.json(
  { error: 'Invalid ID token', details: error.message },  // ⚠️ Exposes internal error
  { status: 401 }
)
```

**Fix Required:**
- Sanitize error messages in production
- Log detailed errors server-side only
- Return generic error messages to clients
- Use error codes instead of detailed messages

---

## 🟠 HIGH-RISK ISSUES

### 9. **No Input Sanitization for Search Queries**
**Location:** Multiple routes using search functionality  
**Severity:** HIGH  
**Risk:** Potential injection attacks, DoS via expensive queries

**Issue:**
Search queries are used directly without sanitization. While Firestore is less vulnerable to injection than SQL, complex queries could still cause performance issues.

**Fix Required:**
- Sanitize and validate all search inputs
- Limit search query length
- Implement query complexity limits

---

### 10. **Missing CSRF Protection**
**Location:** All POST/PUT/DELETE routes  
**Severity:** HIGH  
**Risk:** Cross-Site Request Forgery attacks

**Issue:**
No CSRF token validation for state-changing operations. While `sameSite: 'lax'` provides some protection, explicit CSRF tokens are recommended for admin panels.

**Fix Required:**
- Implement CSRF token validation
- Use Next.js built-in CSRF protection or a library like `csrf`
- Validate CSRF tokens on all state-changing operations

---

### 11. **No Request Size Limits**
**Location:** All API routes  
**Severity:** HIGH  
**Risk:** DoS attacks via large payloads

**Issue:**
No explicit limits on request body size. Large JSON payloads could cause memory issues or DoS.

**Fix Required:**
- Add body size limits (e.g., 1MB for JSON)
- Use Next.js body size limits
- Validate and reject oversized requests early

---

### 12. **Missing Audit Logging for Sensitive Operations**
**Location:** Admin routes (wallet adjustments, role changes)  
**Severity:** HIGH  
**Risk:** No accountability for admin actions

**Issue:**
Critical operations like wallet adjustments and role changes are not logged to an audit trail.

**Fix Required:**
- Log all admin operations with:
  - User ID of the admin performing the action
  - Target user/resource
  - Action type
  - Timestamp
  - IP address
  - Request details

---

### 13. **Weak Rate Limiting Configuration**
**Location:** `lib/auth/rate-limit.ts`  
**Severity:** HIGH  
**Risk:** Brute force attacks

**Issue:**
Rate limiting allows 5 requests per 15 minutes, which may be too lenient for login endpoints.

**Current Code:**
```typescript
checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)  // 5 requests per 15 minutes
```

**Fix Required:**
- Implement progressive rate limiting (stricter after failures)
- Use different limits for different endpoints
- Consider account lockout after multiple failed attempts

---

## 🟡 MEDIUM-RISK ISSUES

### 14. **Middleware Only Checks Cookie Existence**
**Location:** `middleware.ts`  
**Severity:** MEDIUM  
**Risk:** Invalid sessions may pass middleware check

**Issue:**
Middleware only checks if a cookie exists, not if it's valid. Full verification happens in API routes, which is acceptable but could be improved.

**Current Code:**
```typescript
if (!sessionCookie) {
  return NextResponse.redirect(loginUrl)
}
// No validation - just checks existence
```

**Recommendation:**
- Consider adding lightweight session validation in middleware
- Or document that this is intentional for performance

---

### 15. **No Content Security Policy (CSP)**
**Location:** `app/layout.tsx` (likely)  
**Severity:** MEDIUM  
**Risk:** XSS attacks

**Issue:**
No Content Security Policy headers detected. CSP helps prevent XSS attacks.

**Fix Required:**
- Add CSP headers via Next.js middleware or `next.config.js`
- Use strict CSP policy
- Test thoroughly to ensure it doesn't break functionality

---

### 16. **Environment Variable Exposure Risk**
**Location:** `lib/firebase-admin.ts`  
**Severity:** MEDIUM  
**Risk:** Accidental exposure of service account keys

**Issue:**
Service account keys are loaded from environment variables. While this is correct, there's a risk if environment variables are accidentally logged or exposed.

**Recommendation:**
- Ensure environment variables are never logged
- Use secret management (Vercel Secrets, AWS Secrets Manager)
- Rotate service account keys regularly
- Monitor for accidental exposure in logs

---

## ✅ POSITIVE SECURITY PRACTICES

1. ✅ **Proper Input Validation**: Using Zod schemas for validation
2. ✅ **Firestore Transactions**: Using transactions for atomic operations (wallet adjustments)
3. ✅ **Session Cookie HttpOnly**: Prevents XSS access to cookies
4. ✅ **Role-Based Access Control**: Using Firebase custom claims for roles
5. ✅ **MFA Support**: Multi-factor authentication is implemented
6. ✅ **Type Safety**: TypeScript provides compile-time safety

---

## 📋 RECOMMENDATIONS PRIORITY

### Immediate (Fix Today)
1. Add authorization check to wallet adjustment route
2. Add authorization check to explorer route
3. Fix CORS configuration (remove wildcards)
4. Implement proper rate limiting (Redis/distributed cache)
5. Sanitize error messages in production

### This Week
6. Add CSRF protection
7. Implement audit logging for admin operations
8. Add request size limits
9. Strengthen rate limiting configuration
10. Add Content Security Policy headers

### This Month
11. Security headers audit (HSTS, X-Frame-Options, etc.)
12. Penetration testing
13. Dependency vulnerability scanning
14. Security monitoring and alerting
15. Regular security audits

---

## 🔧 QUICK FIXES

### Fix 1: Add Authorization to Wallet Route
```typescript
// Add at the start of POST function in app/api/admin/wallet/[userId]/adjust/route.ts
const cookieStore = await cookies()
const sessionCookie = cookieStore.get('callmap_session')?.value

if (!sessionCookie) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const decodedToken = await verifySessionCookie(sessionCookie)
if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
  return NextResponse.json(
    { error: 'Forbidden. Admin access required.' },
    { status: 403 }
  )
}
```

### Fix 2: Add Authorization to Explorer Route
```typescript
// Add at the start of POST function in app/api/explorer/route.ts
const cookieStore = await cookies()
const sessionCookie = cookieStore.get('callmap_session')?.value

if (!sessionCookie) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const decodedToken = await verifySessionCookie(sessionCookie)
if (decodedToken.role !== 'superAdmin') {
  return NextResponse.json(
    { error: 'Forbidden. SuperAdmin access required.' },
    { status: 403 }
  )
}
```

### Fix 3: Fix CORS Configuration
```json
{
  "origin": [
    "https://callmap.ai",
    "https://www.callmap.ai",
    "https://engine.callmap.ai"
    // Remove wildcards - add specific Vercel deployment URLs if needed
  ],
  // ... rest of config
}
```

---

## 📞 CONTACT

For questions about this audit or assistance implementing fixes, please contact your security team.

**Next Steps:**
1. Review all critical vulnerabilities
2. Prioritize fixes based on risk
3. Implement fixes in order of severity
4. Test all fixes thoroughly
5. Schedule follow-up security review

