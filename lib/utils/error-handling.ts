/**
 * Secure Error Handling Utilities
 * 
 * SECURITY: Provides safe error handling that doesn't leak sensitive information
 */

import { NextResponse } from 'next/server'

/**
 * Sanitize error message for client response
 * 
 * SECURITY: Never exposes stack traces, internal paths, or sensitive data to clients
 */
export function sanitizeErrorMessage(error: unknown, isProduction: boolean = false): string {
  if (error instanceof Error) {
    // In production, return generic messages
    if (isProduction) {
      // Map known error types to user-friendly messages
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        return 'Authentication required'
      }
      if (error.message.includes('Forbidden') || error.message.includes('403')) {
        return 'Access denied'
      }
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        return 'Resource not found'
      }
      if (error.message.includes('Validation') || error.message.includes('Invalid')) {
        return 'Invalid request data'
      }
      // Generic error for everything else
      return 'An error occurred. Please try again later.'
    }
    
    // In development, return the actual error message
    return error.message
  }
  
  // For non-Error types, return generic message
  return 'An unexpected error occurred'
}

/**
 * Create a safe error response
 * 
 * SECURITY: Logs full error server-side but returns sanitized message to client
 */
export function safeErrorResponse(
  error: unknown,
  statusCode: number = 500,
  isProduction: boolean = false
): NextResponse {
  // Log full error server-side
  console.error('[API Error]', error)
  
  // Return sanitized message to client
  const sanitizedMessage = sanitizeErrorMessage(error, isProduction)
  
  return NextResponse.json(
    {
      error: sanitizedMessage,
      ...(isProduction ? {} : { _dev: error instanceof Error ? error.message : String(error) }),
    },
    { status: statusCode }
  )
}

/**
 * Check if error should be logged to security events
 */
export function isSecurityRelevantError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('access denied') ||
      message.includes('invalid session') ||
      message.includes('csrf') ||
      message.includes('rate limit')
    )
  }
  return false
}

