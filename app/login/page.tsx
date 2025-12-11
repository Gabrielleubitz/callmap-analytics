"use client"

/**
 * Login Page
 * 
 * BUG FIX: Removed direct imports from firebase/auth and firebase/app.
 * Now uses only the helper functions from lib/auth/client.ts which use
 * the singleton Firebase app from lib/firebase.ts.
 * 
 * This prevents "default Firebase app does not exist" errors because:
 * 1. All Firebase operations use the same app instance
 * 2. handleAuthSuccess accepts idToken string, not User object
 * 3. No Firebase functions are called in handleAuthSuccess
 */

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, signInWithGoogle, getCurrentUser, checkMFARequired, getIdToken, getMFAStatus } from "@/lib/auth/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaResolver, setMfaResolver] = useState<any>(null)

  const redirect = searchParams.get('redirect') || '/'
  const errorParam = searchParams.get('error')

  useEffect(() => {
    // Show error from URL params
    if (errorParam === 'access_denied') {
      setError('Access denied. Admin privileges required.')
    } else if (errorParam === 'session_invalid') {
      setError('Your session has expired. Please log in again.')
    } else if (errorParam === 'invalid_role') {
      setError('Invalid user role. Please contact an administrator.')
    }
  }, [errorParam])

  /**
   * Handle successful authentication
   * 
   * BUG FIX: This function now accepts an idToken string instead of a User object.
   * This prevents "default Firebase app does not exist" errors because:
   * 1. The Firebase work (sign-in and token retrieval) is done in signIn/signInWithGoogle
   * 2. This function only calls the API route, no Firebase functions
   * 3. No User objects are passed around that might be from different app instances
   */
  const handleAuthSuccess = async (idToken: string) => {
    try {
      // Exchange ID token for session cookie
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          // Access denied - redirect to access revoked page
          router.push('/access-revoked')
          return
        }
        console.error('[Login] /api/auth/login failed', response.status, data)
        throw new Error(data?.error || 'Login failed')
      }

      // On success, redirect to dashboard
      router.push(redirect)
    } catch (err: any) {
      console.error('[Login] Auth success handler error:', err)
      setError(err.message || 'Failed to complete login. Please try again.')
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Sign in with Firebase Auth - returns ID token string
      const idToken = await signIn(email, password)
      await handleAuthSuccess(idToken)
    } catch (err: any) {
      console.error('[Login] Error:', err)
      // Use the error message from Firebase Auth (already user-friendly)
      const errorMessage = err.message || 'Login failed. Please check your credentials and try again.'
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Sign in with Google - returns ID token string
      // 
      // NOTE: You may see a "Cross-Origin-Opener-Policy policy would block the window.close call"
      // warning in the console. This is a known Chrome/Firebase popup interaction warning
      // that occurs when Firebase closes the Google sign-in popup window. It is harmless
      // and does not affect sign-in functionality. If you want to avoid it, you can switch
      // to signInWithRedirect instead of signInWithPopup, but that changes the UX flow.
      const idToken = await signInWithGoogle()
      await handleAuthSuccess(idToken)
    } catch (err: any) {
      console.error('[Google Sign-In] Error:', err)
      const errorMessage = err.message || 'Google sign-in failed. Please try again.'
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const handleMFAVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const user = getCurrentUser()
      if (!user) {
        throw new Error('User not found')
      }

      // Handle MFA verification
      // This is a simplified version - full implementation would use multiFactorResolver
      // Get ID token from current user (guaranteed to be from correct app instance)
      const idToken = await getIdToken(user, false)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken, mfaVerificationCode: mfaCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'MFA verification failed')
      }

      router.push(redirect)
    } catch (err: any) {
      console.error('[MFA] Error:', err)
      setError(err.message || 'MFA verification failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Callmap Analytics</CardTitle>
          <CardDescription>Sign in to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <ErrorState
              title="Login failed"
              description={error}
              variant="banner"
              className="mb-4"
            />
          )}

          {!mfaRequired ? (
            <div className="space-y-4">
              {/* Google Sign-In Button */}
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="admin@callmap.com"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Signing in...' : 'Sign in with Email'}
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleMFAVerification} className="space-y-4">
              <div>
                <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-1">
                  MFA Verification Code
                </label>
                <input
                  id="mfaCode"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Verifying...' : 'Verify'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMfaRequired(false)
                  setMfaCode("")
                }}
                className="w-full"
              >
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

