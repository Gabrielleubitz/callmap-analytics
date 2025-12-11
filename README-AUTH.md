# Authentication & Authorization Setup

This document describes the authentication and authorization system for the Callmap Analytics dashboard.

## Overview

The dashboard uses:
- **Firebase Authentication** for user login
- **Session cookies** for secure server-side authentication
- **Custom claims** for role-based access control (RBAC)
- **Multi-factor authentication (MFA)** - mandatory for all admins
- **Middleware protection** for all admin routes

## Setup Instructions

### 1. Environment Variables

Ensure these environment variables are set in `.env.local`:

```env
# Firebase Client SDK (for login)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# Firebase Admin SDK (already configured)
FIREBASE_SERVICE_ACCOUNT_KEY=...
# OR
FIREBASE_SERVICE_ACCOUNT_PATH=...
```

### 2. Enable Firebase Authentication

In Firebase Console:
1. Go to Authentication > Sign-in method
2. Enable **Email/Password** provider
3. Enable **Multi-factor authentication** (TOTP)

### 3. Set Up First Admin User

Use the provided script to assign admin role to a user:

```bash
# Make a user a superAdmin
npx ts-node scripts/setAdminRole.ts <user-uid> superAdmin

# Make a user a regular admin
npx ts-node scripts/setAdminRole.ts <user-uid> admin

# Remove admin access
npx ts-node scripts/setAdminRole.ts <user-uid> remove
```

### 4. First Login Flow

1. User signs in with email/password at `/login`
2. If MFA is not enrolled, user is redirected to `/setup-mfa`
3. User scans QR code with authenticator app
4. User enters verification code
5. User is redirected to dashboard

## Security Features

### Session Cookies
- **HTTP-only**: Prevents XSS attacks
- **Secure**: Only sent over HTTPS in production
- **SameSite=lax**: Prevents CSRF attacks
- **5-day expiration**: Balances security and usability

### Rate Limiting
- Login attempts limited to 5 per 15 minutes per IP
- Prevents brute force attacks

### Middleware Protection
- All admin routes protected by middleware
- Verifies session cookie on every request
- Checks `isAdmin` and `role` custom claims
- Redirects to `/login` if unauthorized

### MFA Enforcement
- MFA is mandatory for all admin users
- TOTP-based (Google Authenticator, Microsoft Authenticator, etc.)
- Checked during login flow

## User Roles

- **superAdmin**: Full access, can manage other admins
- **admin**: Standard admin access to dashboard

## Admin Management

SuperAdmins can manage access at `/admin/manage-access`:
- View all users
- Assign/revoke admin roles
- See MFA status
- Revoke access (forces immediate logout)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Exchange ID token for session cookie
- `GET /api/auth/session` - Verify current session
- `POST /api/auth/logout` - Delete session cookie
- `POST /api/auth/mfa/enroll` - Start MFA enrollment
- `POST /api/auth/mfa/verify` - Complete MFA enrollment

### Admin Management (superAdmin only)
- `GET /api/admin/users` - List all users
- `POST /api/admin/set-role` - Assign admin role
- `POST /api/admin/revoke-access` - Revoke admin access

## Troubleshooting

### "Firebase Auth not initialized"
- Check that `NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` are set
- Verify Firebase project configuration

### "Access denied" on login
- User doesn't have `isAdmin: true` custom claim
- Run `setAdminRole.ts` script to assign admin role

### "MFA verification failed"
- Ensure MFA is enabled in Firebase Console
- Verify the TOTP code is correct and not expired
- Check that the authenticator app time is synchronized

### Session expires immediately
- Check that Firebase Admin SDK is properly initialized
- Verify service account has `auth` permissions
- Check server logs for session verification errors

## Production Checklist

- [ ] Environment variables set in production
- [ ] Firebase Authentication enabled
- [ ] MFA enabled in Firebase Console
- [ ] First admin user created and assigned role
- [ ] HTTPS enabled (required for secure cookies)
- [ ] Rate limiting configured (consider Redis for production)
- [ ] Session cookie expiration reviewed
- [ ] Admin management page access restricted

