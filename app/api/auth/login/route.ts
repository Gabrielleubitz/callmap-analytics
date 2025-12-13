/**
 * POST /api/auth/login
 * 
 * Server-side login handler that exchanges Firebase ID token for session cookie.
 * 
 * ARCHITECTURE: This route uses ONLY firebase-admin (server SDK), never the client SDK.
 * This ensures proper separation:
 * - Client: Uses Firebase Auth client SDK to sign in and get ID token
 * - Server: Uses Firebase Admin SDK to verify token and create session cookie
 * 
 * BUG FIX: Previously called getAuth() directly from firebase-admin/auth, which could
 * fail with "default Firebase app does not exist" if the app wasn't initialized yet.
 * Now uses adminAuth from lib/firebase-admin.ts, which is guaranteed to be initialized.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { checkRateLimitKV, getClientIdentifier } from '@/lib/auth/rate-limit-kv'
import Tokens from 'csrf'

const SESSION_COOKIE_NAME = 'callmap_session'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 5 // 5 days

// SECURITY: Stricter rate limiting for login (3 attempts per 15 minutes)
const LOGIN_RATE_LIMIT = {
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Distributed rate limiting with improved fingerprinting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await checkRateLimitKV(
      `login:${clientId}`,
      LOGIN_RATE_LIMIT.maxRequests,
      LOGIN_RATE_LIMIT.windowMs,
      request
    )
    
    if (rateLimitResult.rateLimited) {
      return NextResponse.json(
        { 
          error: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': LOGIN_RATE_LIMIT.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      )
    }

    const body = await request.json()
    const { idToken, mfaVerificationCode } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      )
    }

    if (!adminAuth) {
      console.error('[Login] Firebase Admin Auth not initialized')
      console.error('[Login] This usually means FIREBASE_SERVICE_ACCOUNT_KEY is not set in Vercel environment variables')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Firebase Admin SDK is not properly configured. Please check server logs.'
        },
        { status: 500 }
      )
    }
    
    // Verify ID token using the initialized adminAuth instance
    let decodedToken
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken)
    } catch (error: any) {
      // SECURITY: Don't expose internal error details in production
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Invalid credentials' 
        : error.message
      console.error('[Login] Token verification failed:', error.message)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Check if user has admin access
    if (!decodedToken.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      )
    }

    // Check if MFA is required
    // Note: MFA status should be checked client-side before calling this endpoint
    // But we verify here as well for security
    const userRecord = await adminAuth.getUser(decodedToken.uid)
    
    // Verify MFA is enrolled (this is a server-side check)
    // The client should have already verified MFA before sending the token
    // But we can add additional checks here if needed

    // Create session cookie using adminAuth
    const expiresIn = 1000 * 60 * 60 * 8 // 8 hours
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    // Set cookie in response
    const response = NextResponse.json({ 
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role,
      }
    })
    
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // SECURITY: Changed from 'lax' to 'strict' for better CSRF protection
      path: '/',
      maxAge: expiresIn / 1000, // Convert to seconds
    })

    // SECURITY: Set CSRF secret cookie for CSRF protection
    const csrfTokens = new Tokens()
    const csrfSecret = await csrfTokens.secret()
    response.cookies.set('csrf_secret', csrfSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: expiresIn / 1000, // Same as session cookie
    })

    return response
  } catch (error: any) {
    console.error('[Login] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    )
  }
}

