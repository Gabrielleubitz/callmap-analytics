# Security Features Setup Guide

This guide will help you set up the new security features for production deployment on Vercel.

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Vercel KV Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Storage** tab
4. Click **Create Database**
5. Select **KV** (Key-Value store)
6. Name it (e.g., `analytics-kv`)
7. Click **Create**

### Step 2: Add Environment Variables

1. In your Vercel project, go to **Settings** → **Environment Variables**
2. Add the following variables:

**For Rate Limiting:**
```
KV_REST_API_URL=https://your-kv-database.vercel-storage.com
KV_REST_API_TOKEN=your-kv-token-here
```

**For CSRF Protection (optional):**
```
ENABLE_CSRF_PROTECTION=true
```

3. Copy the values from the KV database page:
   - `KV_REST_API_URL` - Found in the KV database overview
   - `KV_REST_API_TOKEN` - Click "Show" next to the token

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment

---

## ✅ Verification

### Check Rate Limiting

1. Try logging in with wrong credentials 4 times
2. On the 4th attempt, you should see: "Too many login attempts"
3. Check Vercel KV dashboard - you should see rate limit entries

### Check CSRF Protection

1. Make a POST request to `/api/admin/wallet/[userId]/adjust` without CSRF token
2. You should receive a 403 error
3. Get CSRF token from `/api/auth/csrf-token`
4. Include it in `X-CSRF-Token` header - request should succeed

### Check Security Headers

1. Open your site in browser
2. Open DevTools → Network tab
3. Click on any request
4. Check Response Headers:
   - `Content-Security-Policy` should be present
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security` (in production)

---

## 🔧 Configuration Options

### Disable CSRF Protection

If you want to disable CSRF protection (not recommended):

```bash
ENABLE_CSRF_PROTECTION=false
```

### Adjust Rate Limits

Edit `lib/auth/rate-limit-kv.ts` or the specific route to change limits:

```typescript
// Login route: 3 attempts per 15 minutes
const LOGIN_RATE_LIMIT = {
  maxRequests: 3,        // Change this
  windowMs: 15 * 60 * 1000, // Change this
}
```

### Customize CSP Headers

Edit `middleware.ts` → `addSecurityHeaders` function:

```typescript
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' https://your-cdn.com", // Add your domains
  // ...
]
```

---

## 📊 Monitoring

### Vercel KV Usage

1. Go to Vercel Dashboard → Storage → Your KV Database
2. Check **Usage** tab for:
   - Storage used
   - Read/Write operations
   - Cost (if over free tier)

### Rate Limiting Logs

Check Vercel function logs for rate limiting:
1. Go to **Deployments** → Click on deployment
2. Click **Functions** tab
3. Check logs for rate limit messages

### CSP Violations

1. Open browser DevTools → Console
2. Look for CSP violation warnings
3. Adjust CSP directives in `middleware.ts` if needed

---

## 🐛 Troubleshooting

### Rate Limiting Not Working

**Problem:** Rate limits not enforced

**Solutions:**
1. Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
2. Check Vercel KV database is active
3. Check function logs for errors
4. System falls back to in-memory if KV unavailable (check logs)

### CSRF Token Errors

**Problem:** "CSRF token validation failed"

**Solutions:**
1. Ensure user is logged in (CSRF secret set during login)
2. Verify CSRF token is included in `X-CSRF-Token` header
3. Check token is fresh (get new token if session expired)
4. Verify `ENABLE_CSRF_PROTECTION` is not set to `false`

### CSP Blocking Resources

**Problem:** Resources blocked by CSP

**Solutions:**
1. Check browser console for CSP violation messages
2. Add allowed domains to CSP directives in `middleware.ts`
3. For Firebase, `unsafe-eval` is required (this is normal)

---

## 💰 Cost Considerations

### Vercel KV Free Tier

- **Storage:** 256 MB
- **Reads:** 10 million/month
- **Writes:** 10 million/month

**For rate limiting:** This is more than enough for most applications.

### If You Exceed Free Tier

- **Storage:** $0.20/GB/month
- **Reads:** $0.20 per million
- **Writes:** $0.20 per million

**Estimate:** For 1000 users with 10 login attempts/day:
- ~300K reads/month (well within free tier)
- ~300K writes/month (well within free tier)

---

## 🔒 Security Best Practices

1. **Never commit** `KV_REST_API_TOKEN` to git
2. **Rotate tokens** periodically (every 90 days)
3. **Monitor** rate limit violations for attack patterns
4. **Review** CSP violations regularly
5. **Keep** dependencies updated (`npm audit`)

---

## 📚 Additional Resources

- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSRF Protection Guide](https://owasp.org/www-community/attacks/csrf)

---

## ✅ Checklist

Before going to production:

- [ ] Vercel KV database created
- [ ] Environment variables set
- [ ] Application redeployed
- [ ] Rate limiting tested
- [ ] CSRF protection tested
- [ ] Security headers verified
- [ ] CSP violations checked
- [ ] Monitoring set up

---

**Need Help?** Check the main documentation in `SECURITY_ENHANCEMENTS.md`

