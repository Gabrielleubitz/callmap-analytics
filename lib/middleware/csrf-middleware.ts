/**
 * CSRF Middleware Helper
 * 
 * SECURITY: Validates CSRF tokens for state-changing operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCSRFToken, requiresCSRFProtection } from '@/lib/auth/csrf'

/**
 * Middleware to validate CSRF tokens
 * Call this at the start of API routes that need CSRF protection
 * 
 * @param request NextRequest object
 * @returns NextResponse with error if invalid, null if valid
 */
export async function validateCSRF(
  request: NextRequest
): Promise<NextResponse | null> {
  // Check if this route requires CSRF protection
  if (!requiresCSRFProtection(request.method, request.nextUrl.pathname)) {
    return null // No CSRF required, continue
  }
  
  // Validate CSRF token
  const validation = await validateCSRFToken(request)
  
  if (!validation.valid) {
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'production' 
          ? 'Request validation failed' 
          : validation.error || 'CSRF token validation failed' 
      },
      { status: 403 }
    )
  }
  
  return null // CSRF valid, continue
}

