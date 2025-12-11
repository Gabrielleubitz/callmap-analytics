"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, getIdToken, getMFAStatus, startTOTPEnrollment, completeTOTPEnrollment } from "@/lib/auth/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { QRCodeSVG } from "qrcode.react"

export default function SetupMFAPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [secret, setSecret] = useState<string>("")
  const [verificationCode, setVerificationCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrollmentSession, setEnrollmentSession] = useState<any>(null)

  const checkMFAStatus = useCallback(async () => {
    try {
      const user = getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Check if MFA is available
      if (!user.multiFactor) {
        setError('Multi-factor authentication is not enabled in Firebase. Please enable it in Firebase Console > Authentication > Sign-in method > Multi-factor authentication, then refresh this page.')
        setIsLoading(false)
        return
      }

      const mfaStatus = await getMFAStatus(user)
      if (mfaStatus.isEnrolled) {
        setIsEnrolled(true)
        setIsLoading(false)
        return
      }

      // Start enrollment
      await startEnrollment()
    } catch (err: any) {
      console.error('[MFA Setup] Error:', err)
      setError(err.message || 'Failed to check MFA status')
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    checkMFAStatus()
  }, [checkMFAStatus])

  const startEnrollment = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Start TOTP enrollment using Firebase client SDK
      const user = getCurrentUser()
      if (!user) {
        throw new Error('User not found. Please sign in first.')
      }

      // Use Firebase client SDK to start TOTP enrollment
      const enrollmentData = await startTOTPEnrollment(user)
      
      setSecret(enrollmentData.secret)
      setQrCodeUrl(enrollmentData.qrCodeUrl)
      setEnrollmentSession(enrollmentData.session)

      setIsLoading(false)
    } catch (err: any) {
      console.error('[MFA Setup] Enrollment error:', err)
      setError(err.message || 'Failed to start MFA enrollment. Make sure Firebase Auth is properly configured.')
      setIsLoading(false)
    }
  }

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifying(true)
    setError(null)

    try {
      const user = getCurrentUser()
      if (!user) {
        throw new Error('User not found. Please sign in first.')
      }

      if (!enrollmentSession) {
        throw new Error('Enrollment session not found. Please start enrollment again.')
      }

      // Complete TOTP enrollment using Firebase client SDK
      await completeTOTPEnrollment(user, enrollmentSession, verificationCode)

      // MFA enrollment successful - get new ID token and create session
      const idToken = await getIdToken(user, true) // Force refresh to get token with MFA

      // Exchange for session cookie
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session')
      }

      // MFA enrollment successful
      setIsEnrolled(true)
      
      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err: any) {
      console.error('[MFA Setup] Verification error:', err)
      setError(err.message || 'MFA verification failed. Please check your code and try again.')
      setIsVerifying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingState variant="page" message="Setting up MFA..." />
      </div>
    )
  }

  if (isEnrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>MFA Already Enrolled</CardTitle>
            <CardDescription>You already have MFA set up. Redirecting to dashboard...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Up Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app to enable MFA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <ErrorState
              title="Setup failed"
              description={error}
              variant="banner"
            />
          )}

          {!qrCodeUrl && !error && (
            <div className="text-center py-8">
              <p className="text-gray-600">Preparing MFA setup...</p>
            </div>
          )}

          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG value={qrCodeUrl} size={256} />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Scan this QR code with an authenticator app like:
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• Google Authenticator</li>
                  <li>• Microsoft Authenticator</li>
                  <li>• Authy</li>
                </ul>
              </div>
              {secret && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                    {secret}
                  </code>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleVerification} className="space-y-4">
            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                Enter verification code
              </label>
              <input
                id="verificationCode"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <Button
              type="submit"
              disabled={isVerifying || verificationCode.length !== 6}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify and Enable MFA'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

