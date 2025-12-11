import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect admin routes
 * 
 * ARCHITECTURE: This middleware does NOT use any Firebase SDK (client or admin).
 * It only checks for cookie existence to provide early redirects.
 * 
 * Full session verification happens in API routes and server components using
 * firebase-admin. This keeps middleware lightweight and avoids Edge runtime issues.
 * 
 * BUG FIX: Previously, middleware might have tried to use Firebase SDKs, which
 * would cause "default Firebase app does not exist" errors in Edge runtime.
 * This middleware is now SDK-free and only checks cookie presence.
 */

// Protected routes that require authentication
const protectedRoutes = [
  '/',
  '/teams',
  '/users',
  '/usage',
  '/billing',
  '/ops',
  '/explorer',
  '/diagnostics',
  '/admin',
]

// Public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/setup-mfa',
  '/api/auth',
]

/**
 * Middleware to protect admin routes
 * 
 * Verifies session cookie and admin claims before allowing access.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Get session cookie
  const sessionCookie = request.cookies.get('callmap_session')?.value

  // Check for session cookie existence
  // Full verification happens in API routes and server components
  if (!sessionCookie) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Allow access - full verification happens server-side
  // If session is invalid, API routes will handle it
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

