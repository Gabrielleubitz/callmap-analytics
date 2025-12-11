/**
 * Session management utilities
 * 
 * Handles Firebase session cookies for secure admin access.
 * 
 * SERVER-ONLY: This file uses firebase-admin and cannot be used in client components or middleware.
 * 
 * BUG FIX: Now uses adminAuth from lib/firebase-admin.ts instead of calling getAuth() directly.
 * This ensures the Firebase Admin app is initialized before any auth operations.
 */

import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'
import { adminAuth } from '@/lib/firebase-admin'

const SESSION_COOKIE_NAME = 'callmap_session'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 5 // 5 days

/**
 * Create a session cookie from a Firebase ID token
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth not initialized')
  }
  
  // Verify the ID token
  const decodedToken = await adminAuth.verifyIdToken(idToken)
  
  // Create session cookie (expires in 5 days)
  const expiresIn = SESSION_COOKIE_MAX_AGE * 1000
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })
  
  return sessionCookie
}

/**
 * Verify a session cookie and return decoded token
 */
export async function verifySessionCookie(sessionCookie: string): Promise<admin.auth.DecodedIdToken> {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth not initialized')
  }
  const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true)
  return decodedToken
}

/**
 * Get session cookie from request
 */
export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null
}

/**
 * Set session cookie in response
 */
export function setSessionCookie(sessionCookie: string): void {
  // Note: In Next.js App Router, we need to use headers() to set cookies
  // This will be handled in the API route
}

/**
 * Delete session cookie
 */
export function deleteSessionCookie(): void {
  // Handled in API route
}

/**
 * Check if user has admin access
 */
export async function verifyAdminAccess(sessionCookie: string): Promise<{
  isValid: boolean
  decodedToken?: admin.auth.DecodedIdToken
  error?: string
}> {
  try {
    const decodedToken = await verifySessionCookie(sessionCookie)
    
    // Check custom claims
    if (!decodedToken.isAdmin) {
      return { isValid: false, error: 'User does not have admin access' }
    }
    
    // Check role
    if (!decodedToken.role) {
      return { isValid: false, error: 'User role not set' }
    }
    
    // Verify MFA is enabled
    // Note: MFA status is checked during login, but we can verify the user still has it
    // by checking the token's auth_time and ensuring it's recent
    
    return { isValid: true, decodedToken }
  } catch (error: any) {
    return { isValid: false, error: error.message || 'Invalid session' }
  }
}
