/**
 * Error Classification Logic
 * 
 * Automatically classifies errors as expected/unexpected, critical/non-critical, and severity.
 * Expected errors are valid product constraints (limits, permissions).
 * Unexpected errors are bugs or infrastructure issues.
 */

import { ErrorSeverity, SupportErrorEvent } from '@/lib/types'

export interface ErrorClassification {
  expected: boolean
  critical: boolean
  severity: ErrorSeverity
}

/**
 * Expected error patterns (valid product constraints)
 */
const EXPECTED_ERROR_PATTERNS = [
  // Token/plan limits
  /token.*limit/i,
  /quota.*exceeded/i,
  /insufficient.*tokens/i,
  /plan.*limit/i,
  /upgrade.*required/i,
  /monthly.*quota/i,
  
  // Permission/access
  /permission.*denied/i,
  /unauthorized/i,
  /forbidden/i,
  /access.*denied/i,
  /not.*authorized/i,
  
  // File/format constraints
  /invalid.*file.*type/i,
  /file.*too.*large/i,
  /unsupported.*format/i,
  /max.*file.*size/i,
  /file.*size.*limit/i,
  
  // Validation errors
  /invalid.*input/i,
  /validation.*failed/i,
  /required.*field/i,
  /invalid.*email/i,
  /invalid.*format/i,
  
  // Business logic constraints
  /workspace.*not.*found/i,
  /user.*not.*member/i,
  /invite.*expired/i,
  /subscription.*required/i,
]

/**
 * Critical error patterns (block core workflows)
 */
const CRITICAL_ERROR_PATTERNS = [
  // Authentication failures
  /authentication.*failed/i,
  /session.*expired/i,
  /token.*invalid/i,
  
  // Database/storage failures
  /database.*error/i,
  /firestore.*error/i,
  /storage.*error/i,
  /connection.*failed/i,
  
  // Payment/billing failures
  /payment.*failed/i,
  /stripe.*error/i,
  /billing.*error/i,
  
  // Infrastructure failures
  /service.*unavailable/i,
  /timeout/i,
  /internal.*server.*error/i,
  /500.*error/i,
]

/**
 * Severity mapping based on error characteristics
 */
function determineSeverity(
  message: string,
  expected: boolean,
  critical: boolean
): ErrorSeverity {
  if (critical) return 'critical'
  if (expected) return 'info'
  
  // Unexpected but non-critical = warning
  return 'warning'
}

/**
 * Classify an error based on message, app area, and context
 */
export function classifyError(
  message: string,
  appArea: string,
  errorCode?: string | null,
  metadata?: Record<string, any> | null
): ErrorClassification {
  const messageLower = message.toLowerCase()
  
  // Check if expected (valid product constraint)
  const expected = EXPECTED_ERROR_PATTERNS.some(pattern => 
    pattern.test(message) || pattern.test(appArea)
  ) || 
  // Also check error codes
  (errorCode && /LIMIT|QUOTA|PERMISSION|VALIDATION/i.test(errorCode)) ||
  // Check metadata for limit indicators
  (metadata?.limitExceeded === true || metadata?.quotaExceeded === true)
  
  // Check if critical (blocks core workflows)
  const critical = CRITICAL_ERROR_PATTERNS.some(pattern => 
    pattern.test(message)
  ) ||
  // Critical app areas
  ['billing', 'auth', 'database'].includes(appArea) ||
  // Check metadata
  (metadata?.critical === true)
  
  const severity = determineSeverity(message, expected, critical)
  
  return {
    expected,
    critical,
    severity,
  }
}

/**
 * Get app area from route/action
 */
export function inferAppArea(
  route?: string | null,
  action?: string | null
): string {
  if (route) {
    // Extract app area from route
    if (route.includes('/api/generate-mindmap') || route.includes('/mindmap')) {
      return 'mindmap_creation'
    }
    if (route.includes('/api/upload') || route.includes('/upload')) {
      return 'upload'
    }
    if (route.includes('/api/export') || route.includes('/export')) {
      return 'export'
    }
    if (route.includes('/api/billing') || route.includes('/billing')) {
      return 'billing'
    }
    if (route.includes('/api/audio/transcribe') || route.includes('/transcribe')) {
      return 'ai_generation'
    }
    if (route.includes('/api/workspaces') || route.includes('/workspace')) {
      return 'workspace_management'
    }
    if (route.includes('/api/invite') || route.includes('/invite')) {
      return 'invite_permissions'
    }
  }
  
  if (action) {
    return action.toLowerCase().replace(/\s+/g, '_')
  }
  
  return 'unknown'
}

