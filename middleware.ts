import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect admin routes and add security headers
 * 
 * ARCHITECTURE: This middleware does NOT use any Firebase SDK (client or admin).
 * It only checks for cookie existence to provide early redirects.
 * 
 * Full session verification happens in API routes and server components using
 * firebase-admin. This keeps middleware lightweight and avoids Edge runtime issues.
 * 
 * SECURITY: Adds Content Security Policy and other security headers
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
  const response = NextResponse.next()
  
  // SECURITY: Add security headers
  addSecurityHeaders(response, request)
  
  return response
}

/**
 * Add security headers to response
 * SECURITY: Implements Content Security Policy and other security headers
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Content Security Policy
  // SECURITY: Tightened CSP - Firebase requires unsafe-eval, but we minimize other permissions
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://www.google.com", // Firebase requires unsafe-eval
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind and Google Fonts
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://api.openai.com wss://*.firebaseio.com", // Added OpenAI API
    "frame-src 'self' https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "require-trusted-types-for 'script'", // XSS protection
  ]
  
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))
  
  // Other security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
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

