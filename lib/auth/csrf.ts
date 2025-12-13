/**
 * CSRF Protection Utilities
 * 
 * SECURITY: Implements CSRF token generation and validation for state-changing operations.
 * Works with Vercel serverless functions and Next.js App Router.
 */

import { cookies } from 'next/headers'
import Tokens from 'csrf'

const CSRF_SECRET_COOKIE = 'csrf_secret'
const CSRF_TOKEN_HEADER = 'x-csrf-token'

// Initialize CSRF token generator
const tokens = new Tokens()

/**
 * Generate a CSRF token from the secret stored in cookie
 * Call this when rendering pages that need CSRF protection
 */
export async function generateCSRFToken(): Promise<string> {
  const cookieStore = await cookies()
  
  // Get secret from cookie (must exist, set during login)
  const secret = cookieStore.get(CSRF_SECRET_COOKIE)?.value
  
  if (!secret) {
    throw new Error('CSRF secret not found. User may need to log in again.')
  }
  
  // Generate token from secret
  const token = tokens.create(secret)
  
  return token
}

/**
 * Get CSRF secret from cookie (for server-side token generation)
 */
export async function getCSRFSecret(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_SECRET_COOKIE)?.value || null
}

/**
 * Validate CSRF token from request
 * Call this in API routes that perform state-changing operations
 * 
 * @param request NextRequest object
 * @returns true if valid, false otherwise
 */
export async function validateCSRFToken(request: Request): Promise<{
  valid: boolean
  error?: string
}> {
  try {
    const cookieStore = await cookies()
    const secret = cookieStore.get(CSRF_SECRET_COOKIE)?.value
    
    if (!secret) {
      return { valid: false, error: 'CSRF secret not found' }
    }
    
    // Get token from header
    const token = request.headers.get(CSRF_TOKEN_HEADER)
    
    if (!token) {
      return { valid: false, error: 'CSRF token not provided' }
    }
    
    // Verify token
    const isValid = tokens.verify(secret, token)
    
    if (!isValid) {
      return { valid: false, error: 'Invalid CSRF token' }
    }
    
    return { valid: true }
  } catch (error: any) {
    console.error('[CSRF] Validation error:', error)
    return { valid: false, error: 'CSRF validation failed' }
  }
}

/**
 * Set CSRF secret cookie in response
 * Call this after successful authentication
 */
export function setCSRFSecretCookie(secret: string, response: Response): void {
  // Note: In Next.js App Router, cookies are set via response.cookies
  // This function is a helper that returns the cookie value to set
  // The actual setting should be done in the route handler
}

/**
 * Get CSRF token from request headers
 */
export function getCSRFTokenFromRequest(request: Request): string | null {
  return request.headers.get(CSRF_TOKEN_HEADER)
}

/**
 * Check if route requires CSRF protection
 */
export function requiresCSRFProtection(method: string, pathname: string): boolean {
  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false
  }
  
  // Don't require CSRF for auth endpoints (they use their own protection)
  if (pathname.startsWith('/api/auth/')) {
    return false
  }
  
  // Require CSRF for all other state-changing operations
  return true
}

