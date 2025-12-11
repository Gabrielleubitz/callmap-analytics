import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE_NAME = 'callmap_session'

/**
 * POST /api/auth/logout
 * 
 * Logs out the user by deleting the session cookie.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Delete session cookie
  response.cookies.delete(SESSION_COOKIE_NAME)
  
  return response
}

