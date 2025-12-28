/**
 * Security Event Logging
 * 
 * Logs security-relevant events to Firestore for audit and incident response.
 * Never logs secrets, full tokens, or sensitive user data.
 * 
 * SECURITY: All security events are logged for compliance and incident investigation.
 */

import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'
import type { NextRequest } from 'next/server'

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'permission_denied'
  | 'role_change'
  | 'wallet_adjustment'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'export_request'
  | 'admin_action'
  | 'session_invalid'

export interface SecurityEvent {
  type: SecurityEventType
  userId?: string | null
  userEmail?: string | null
  ipAddress?: string
  userAgent?: string
  action: string
  resource?: string
  result: 'success' | 'failure' | 'denied'
  details?: Record<string, unknown>
  timestamp: Date
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Get user agent from request
 */
function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

/**
 * Log a security event to Firestore
 * 
 * SECURITY: This function never logs secrets, full tokens, or sensitive data.
 * Only metadata and event information is logged.
 */
export async function logSecurityEvent(
  event: Omit<SecurityEvent, 'timestamp'>,
  request?: NextRequest
): Promise<void> {
  try {
    if (!adminDb) {
      console.warn('[Security Log] Firebase Admin not initialized, skipping log')
      return
    }

    // Add request metadata if available
    const ipAddress = request ? getClientIP(request) : undefined
    const userAgent = request ? getUserAgent(request) : undefined

    const securityEvent: SecurityEvent = {
      ...event,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    }

    // Redact sensitive information
    const sanitizedEvent = {
      ...securityEvent,
      // Never log full tokens or secrets
      details: sanitizeDetails(securityEvent.details),
    }

    // Log to Firestore
    await adminDb.collection('security_events').add({
      ...sanitizedEvent,
      timestamp: admin.firestore.Timestamp.fromDate(sanitizedEvent.timestamp),
    })

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Security Event]', sanitizedEvent)
    }
  } catch (error) {
    // Don't throw - logging failures shouldn't break the application
    console.error('[Security Log] Failed to log event:', error)
  }
}

/**
 * Sanitize event details to remove sensitive information
 */
function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) {
    return undefined
  }

  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'api_key', 'authToken']

  for (const [key, value] of Object.entries(details)) {
    const keyLower = key.toLowerCase()
    if (sensitiveKeys.some((sensitive) => keyLower.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'string' && value.length > 500) {
      // Truncate long strings
      sanitized[key] = value.slice(0, 500) + '...'
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Log a failed login attempt
 */
export async function logFailedLogin(
  email: string,
  reason: string,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'login_failure',
      userEmail: email,
      action: 'login',
      result: 'failure',
      details: {
        reason,
        email: email, // Email is okay to log for security purposes
      },
    },
    request
  )
}

/**
 * Log a successful login
 */
export async function logSuccessfulLogin(
  userId: string,
  userEmail: string | null,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'login_success',
      userId,
      userEmail,
      action: 'login',
      result: 'success',
    },
    request
  )
}

/**
 * Log a permission denial
 */
export async function logPermissionDenied(
  userId: string | null,
  action: string,
  resource: string,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'permission_denied',
      userId,
      action,
      resource,
      result: 'denied',
      details: {
        attemptedAction: action,
        resource,
      },
    },
    request
  )
}

/**
 * Log a role change
 */
export async function logRoleChange(
  targetUserId: string,
  newRole: string,
  changedBy: string,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'role_change',
      userId: changedBy,
      action: 'change_role',
      resource: `user:${targetUserId}`,
      result: 'success',
      details: {
        targetUserId,
        newRole,
        changedBy,
      },
    },
    request
  )
}

/**
 * Log a wallet adjustment
 */
export async function logWalletAdjustment(
  userId: string,
  amount: number,
  reason: string,
  adjustedBy: string,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'wallet_adjustment',
      userId: adjustedBy,
      action: 'adjust_wallet',
      resource: `user:${userId}`,
      result: 'success',
      details: {
        targetUserId: userId,
        amount,
        reason,
        adjustedBy,
      },
    },
    request
  )
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  userId: string | null,
  activity: string,
  details: Record<string, unknown>,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'suspicious_activity',
      userId,
      action: activity,
      result: 'failure',
      details,
    },
    request
  )
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
  userId: string | null,
  endpoint: string,
  request: NextRequest
): Promise<void> {
  await logSecurityEvent(
    {
      type: 'rate_limit_exceeded',
      userId,
      action: 'rate_limit',
      resource: endpoint,
      result: 'denied',
      details: {
        endpoint,
      },
    },
    request
  )
}

