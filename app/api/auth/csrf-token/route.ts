/**
 * GET /api/auth/csrf-token
 * 
 * Returns a CSRF token for the current session.
 * Client should include this token in X-CSRF-Token header for state-changing requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionCookie } from '@/lib/auth/session'
import { generateCSRFToken } from '@/lib/auth/csrf'

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    try {
      await verifySessionCookie(sessionCookie)
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Generate CSRF token
    const token = await generateCSRFToken()

    return NextResponse.json({ csrfToken: token })
  } catch (error: any) {
    console.error('[CSRF Token] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}

