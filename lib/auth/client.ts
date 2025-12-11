/**
 * Client-side Firebase Auth utilities
 * 
 * Handles authentication flows including MFA.
 * 
 * BUG FIX: This module now uses getFirebaseAuth() from lib/firebase.ts instead of
 * trying to initialize its own Firebase app. This ensures all User objects and
 * auth operations use the same app instance, preventing "default Firebase app
 * does not exist" errors.
 */

import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  MultiFactorResolver,
  PhoneAuthCredential,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
} from 'firebase/auth'

// CRITICAL: Use the singleton auth instance from lib/firebase.ts
// This ensures all auth operations use the same Firebase app instance
import { getFirebaseAuth } from '@/lib/firebase'

/**
 * Get Firebase Auth instance
 * Always uses the singleton app from lib/firebase.ts
 */
function getAuthInstance() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth can only be used in the browser')
  }
  return getFirebaseAuth()
}

/**
 * Sign in with email and password
 * 
 * BUG FIX: Returns ID token string instead of User object to avoid app instance mismatches
 */
export async function signIn(email: string, password: string): Promise<string> {
  const authInstance = getAuthInstance()
  
  try {
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password)
    // Get ID token immediately from the authenticated user
    const idToken = await userCredential.user.getIdToken()
    return idToken
  } catch (error: any) {
    // Provide more helpful error messages
    const errorCode = error?.code || ''
    
    if (errorCode === 'auth/user-not-found') {
      throw new Error('No account found with this email address.')
    } else if (errorCode === 'auth/wrong-password') {
      throw new Error('Incorrect password.')
    } else if (errorCode === 'auth/invalid-email') {
      throw new Error('Invalid email address.')
    } else if (errorCode === 'auth/invalid-credential') {
      // This error can mean wrong password, user doesn't exist, or account disabled
      throw new Error('Invalid email or password. Please check your credentials and try again.')
    } else if (errorCode === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact an administrator.')
    } else if (errorCode === 'auth/too-many-requests') {
      throw new Error('Too many failed login attempts. Please try again later.')
    } else if (errorCode === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.')
    } else if (errorCode === 'auth/operation-not-allowed') {
      throw new Error('Email/password sign-in is not enabled. Please contact support.')
    }
    
    // Log unexpected errors for debugging
    console.error('[Firebase Auth] Unexpected error:', errorCode, error.message)
    throw new Error(error.message || 'Login failed. Please try again.')
  }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  try {
    const authInstance = getAuthInstance()
    return authInstance.currentUser
  } catch {
    return null
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    const authInstance = getAuthInstance()
    await authInstance.signOut()
  } catch (error) {
    console.error('[Sign Out] Error:', error)
  }
}

/**
 * Check if MFA is required (user has MFA enrolled)
 */
export async function checkMFARequired(user: User): Promise<boolean> {
  const multiFactor = user.multiFactor
  if (!multiFactor) return false
  
  const enrolledFactors = multiFactor.enrolledFactors
  return enrolledFactors.length > 0
}

/**
 * Get MFA enrollment status
 */
export async function getMFAStatus(user: User | null): Promise<{
  isEnrolled: boolean
  enrolledFactors: any[]
}> {
  // Ensure Firebase Auth is initialized
  getAuthInstance()
  
  if (!user) {
    return { isEnrolled: false, enrolledFactors: [] }
  }
  
  const multiFactor = user.multiFactor
  if (!multiFactor) {
    return { isEnrolled: false, enrolledFactors: [] }
  }
  
  try {
    const enrolledFactors = multiFactor.enrolledFactors
    return {
      isEnrolled: enrolledFactors.length > 0,
      enrolledFactors: enrolledFactors,
    }
  } catch (error: any) {
    console.error('[getMFAStatus] Error:', error)
    return { isEnrolled: false, enrolledFactors: [] }
  }
}

/**
 * Start TOTP MFA enrollment
 * Returns enrollment session and secret for QR code
 */
export async function startTOTPEnrollment(user: User): Promise<{
  session: any
  secret: string
  qrCodeUrl: string
}> {
  getAuthInstance() // Ensure auth is initialized

  // Check if multiFactor is available
  if (!user.multiFactor) {
    throw new Error('Multi-factor authentication is not enabled. Please enable MFA in Firebase Console > Authentication > Sign-in method > Multi-factor authentication.')
  }

  const multiFactor = user.multiFactor
  
  try {
    // Get MFA session (this requires the user to be recently authenticated)
    const session = await multiFactor.getSession()
    
    // Generate TOTP secret
    const secret = await TotpMultiFactorGenerator.generateSecret(session)
    
    // Generate QR code URL for authenticator apps
    const accountName = user.email || user.uid
    const issuer = 'Callmap Analytics'
    const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
    
    return {
      session,
      secret,
      qrCodeUrl,
    }
  } catch (error: any) {
    console.error('[TOTP Enrollment] Error:', error)
    
    // Provide helpful error messages
    if (error.code === 'auth/session-expired') {
      throw new Error('Your session has expired. Please sign in again and try setting up MFA.')
    } else if (error.message?.includes('getSession')) {
      throw new Error('Unable to get MFA session. Please sign out and sign in again, then try setting up MFA.')
    }
    
    throw new Error(`Failed to start TOTP enrollment: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Complete TOTP MFA enrollment
 * Verifies the TOTP code and enrolls the factor
 */
export async function completeTOTPEnrollment(
  user: User,
  session: any,
  verificationCode: string
): Promise<void> {
  getAuthInstance() // Ensure auth is initialized

  const multiFactor = user.multiFactor
  if (!multiFactor) {
    throw new Error('Multi-factor authentication not available for this user')
  }
  
  try {
    // Create TOTP assertion for enrollment
    const totpCredential = TotpMultiFactorGenerator.assertionForEnrollment(
      session,
      verificationCode
    )
    
    // Enroll the TOTP factor
    await multiFactor.enroll(totpCredential, user.displayName || user.email || undefined)
  } catch (error: any) {
    console.error('[TOTP Enrollment] Verification error:', error)
    
    // Provide helpful error messages
    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid verification code. Please check your authenticator app and try again.')
    } else if (error.code === 'auth/code-expired') {
      throw new Error('Verification code expired. Please generate a new code and try again.')
    }
    
    throw new Error(`MFA enrollment failed: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Sign in with Google
 * 
 * BUG FIX: This function now gets the ID token immediately after sign-in and returns it.
 * This prevents "default Firebase app does not exist" errors because:
 * 1. We use getFirebaseAuth() which ensures the correct app instance
 * 2. We get the token from the authenticated user immediately
 * 3. The token is passed to handleAuthSuccess, which doesn't need to call Firebase functions
 * 
 * Note: The Cross-Origin-Opener-Policy warning is a browser security warning when
 * Firebase closes the Google sign-in popup. It does not affect functionality.
 * 
 * Returns ID token string (not User object) to avoid app instance mismatches
 */
export async function signInWithGoogle(): Promise<string> {
  const authInstance = getAuthInstance()
  
  try {
    const provider = new GoogleAuthProvider()
    // Use signInWithPopup - the Cross-Origin-Opener-Policy warning is harmless
    const result = await signInWithPopup(authInstance, provider)
    
    // Get ID token immediately from the authenticated user
    // This user is guaranteed to be from the correct app instance
    const idToken = await result.user.getIdToken()
    
    return idToken
  } catch (error: any) {
    const errorCode = error?.code || ''
    
    if (errorCode === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed. Please try again.')
    } else if (errorCode === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked. Please allow popups and try again.')
    } else if (errorCode === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.')
    }
    
    console.error('[Firebase Auth] Google sign-in error:', errorCode, error.message)
    throw new Error(error.message || 'Google sign-in failed. Please try again.')
  }
}

/**
 * Get ID token
 */
export async function getIdToken(user: User | null, forceRefresh = false): Promise<string> {
  // Ensure Firebase Auth is initialized
  const authInstance = getAuthInstance()
  
  // Always prefer currentUser from auth instance - it's guaranteed to be from the correct app
  let targetUser: User | null = null
  
  // Wait for auth state to sync if needed
  if (!authInstance.currentUser) {
    console.log('[getIdToken] Waiting for auth state to sync...')
    let waitCount = 0
    while (!authInstance.currentUser && waitCount < 20) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitCount++
    }
  }
  
  // Use currentUser if available
  if (authInstance.currentUser) {
    // If a user was provided, verify it matches currentUser
    if (user && authInstance.currentUser.uid !== user.uid) {
      console.warn('[getIdToken] User UID mismatch, using currentUser instead')
    }
    targetUser = authInstance.currentUser
  } else if (user) {
    // Fallback to provided user if currentUser is not available
    console.warn('[getIdToken] currentUser not available, using provided user')
    targetUser = user
  }
  
  if (!targetUser) {
    throw new Error('User is not available and no current user found. Please sign in again.')
  }
  
  try {
    // Verify the user object has the getIdToken method
    if (typeof targetUser.getIdToken !== 'function') {
      throw new Error('User object does not have getIdToken method')
    }
    
    // Use the user object's getIdToken method
    const token = await targetUser.getIdToken(forceRefresh)
    return token
  } catch (error: any) {
    console.error('[getIdToken] Error:', error)
    console.error('[getIdToken] Error details:', {
      message: error.message,
      code: error.code,
      userUid: targetUser.uid,
      authInitialized: !!authInstance,
      currentUserUid: authInstance.currentUser?.uid,
      usingCurrentUser: targetUser === authInstance.currentUser,
      hasGetIdToken: typeof targetUser.getIdToken === 'function',
    })
    
    // If Firebase app isn't initialized, the user object might be from a different app
    if (error.message?.includes('default Firebase app does not exist') || 
        error.message?.includes('Firebase app') ||
        error.code === 'auth/app-not-initialized') {
      
      // Try using currentUser if we weren't already
      if (targetUser !== authInstance.currentUser && authInstance.currentUser) {
        console.log('[getIdToken] Retrying with currentUser from auth instance...')
        try {
          return await authInstance.currentUser.getIdToken(forceRefresh)
        } catch (retryError: any) {
          console.error('[getIdToken] Retry with currentUser also failed:', retryError)
        }
      }
      
      // Force re-initialization as last resort
      console.log('[getIdToken] Firebase app not initialized, re-initializing...')
      if (typeof window !== 'undefined') {
        // Clear and re-initialize
        auth = undefined
        app = undefined
        initializeFirebaseAuth()
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Get the new auth instance and current user
        const newAuthInstance = getAuthInstance()
        if (newAuthInstance.currentUser) {
          try {
            return await newAuthInstance.currentUser.getIdToken(forceRefresh)
          } catch (finalError: any) {
            console.error('[getIdToken] Final retry failed:', finalError)
            throw new Error(`Failed to get ID token: ${finalError.message || 'Unknown error'}`)
          }
        }
      }
    }
    
    throw new Error(`Failed to get ID token: ${error.message || 'Unknown error'}`)
  }
}

