import { NextRequest, NextResponse } from 'next/server'
import { createSessionCookie, verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'callmap_session'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 5 // 5 days

/**
 * POST /api/auth/session
 * 
 * Creates a session cookie from a Firebase ID token.
 * Used after successful login.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idToken } = body

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Create session cookie
    const sessionCookie = await createSessionCookie(idToken)

    // Set cookie in response
    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('[Session] Error creating session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/session
 * 
 * Verifies the current session cookie.
 * Can be called from middleware (Edge runtime) or client.
 */
export async function GET(request: NextRequest) {
  try {
    // Get session cookie from request (works for both cookies() and request.cookies)
    let sessionCookie: string | undefined
    
    try {
      const cookieStore = await cookies()
      sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
    } catch {
      // If cookies() fails (e.g., in middleware), try request.cookies
      sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
    }

    if (!sessionCookie) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    // Verify session cookie
    const decodedToken = await verifySessionCookie(sessionCookie)

    return NextResponse.json({
      authenticated: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAdmin: decodedToken.isAdmin,
      role: decodedToken.role,
    })
  } catch (error: any) {
    console.error('[Session] Error verifying session:', error)
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 401 }
    )
  }
}

/**
 * DELETE /api/auth/session
 * 
 * Logs out by deleting the session cookie.
 */
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Delete session cookie
  response.cookies.delete(SESSION_COOKIE_NAME)
  
  return response
}

