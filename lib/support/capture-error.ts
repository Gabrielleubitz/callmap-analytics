/**
 * Error Capture Utility
 * 
 * Use this function throughout the codebase to capture errors.
 * It automatically sends errors to the unified capture API.
 */

import { ErrorSource } from '@/lib/types'

export interface CaptureErrorOptions {
  message: string
  stack?: string | null
  error_code?: string | null
  app_area?: string | null
  route?: string | null
  action?: string | null
  user_id?: string | null
  workspace_id?: string | null
  source: ErrorSource
  metadata?: Record<string, any> | null
}

/**
 * Capture an error to the support system
 * 
 * This is async but doesn't throw - errors are logged but don't block the flow.
 */
export async function captureError(options: CaptureErrorOptions): Promise<void> {
  try {
    // Don't block on error capture - fire and forget
    fetch('/api/support/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    }).catch(err => {
      // Silently fail - we don't want error capture to cause errors
      console.error('[captureError] Failed to send error:', err)
    })
  } catch (err) {
    // Silently fail
    console.error('[captureError] Error:', err)
  }
}

/**
 * Helper to capture errors from try-catch blocks
 */
export function captureException(
  error: Error | unknown,
  context: {
    app_area?: string
    route?: string
    action?: string
    user_id?: string | null
    workspace_id?: string | null
    source: ErrorSource
    metadata?: Record<string, any>
  }
): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : null

  captureError({
    message,
    stack,
    ...context,
    metadata: {
      ...context.metadata,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    },
  })
}

