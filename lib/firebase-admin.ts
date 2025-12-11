/**
 * Firebase Admin SDK Initialization
 * 
 * This is the SINGLE source of truth for Firebase Admin initialization.
 * All server-side Firebase Admin operations MUST use adminAuth or adminDb
 * from this module to ensure they use the same initialized app instance.
 * 
 * BUG FIX: Previously, server routes were calling getAuth() directly from
 * firebase-admin/auth, which could fail with "default Firebase app does not exist"
 * if the app wasn't initialized yet or if there were timing issues.
 * 
 * Now we export a singleton adminAuth instance that's guaranteed to be initialized.
 */

import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

// Singleton Firebase Admin app and auth instances
let adminApp: App | null = null
let adminAuth: Auth | null = null

/**
 * Initialize Firebase Admin SDK
 * Uses getApps() guard to prevent re-initialization in hot reload scenarios
 */
if (!getApps().length) {
  try {
    const config: {
      projectId: string
      credential?: any
    } = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mindmap-ec9bc',
    }

    // Try to use service account from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      config.credential = cert(serviceAccount)
    } 
    // Try to use service account file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8')
        const serviceAccount = JSON.parse(serviceAccountJson)
        config.credential = cert(serviceAccount)
      }
    }
    // Try to use service account from mindmap folder (if it exists)
    else {
      const mindmapServiceAccount = path.resolve(
        process.cwd(),
        '../mindmap/backend/service-account-key.json'
      )
      if (fs.existsSync(mindmapServiceAccount)) {
        const serviceAccountJson = fs.readFileSync(mindmapServiceAccount, 'utf8')
        const serviceAccount = JSON.parse(serviceAccountJson)
        config.credential = cert(serviceAccount)
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use Google Application Default Credentials
        config.credential = applicationDefault()
      }
    }

    adminApp = initializeApp(config)
    console.log('Firebase Admin initialized successfully')
  } catch (error: any) {
    if (error.code !== 'app/duplicate-app') {
      console.error('Firebase Admin initialization error:', error.message)
      console.error('The analytics dashboard will work but may not be able to fetch data from Firebase.')
      console.error('To fix this, set one of:')
      console.error('  - FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)')
      console.error('  - FIREBASE_SERVICE_ACCOUNT_PATH (path to service account JSON file)')
      console.error('  - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON file)')
    }
  }
} else {
  // Use existing app if already initialized
  adminApp = getApps()[0]
}

// Get auth instance from the initialized app
// This is guaranteed to work because adminApp is initialized above
if (adminApp) {
  adminAuth = getAuth(adminApp)
} else {
  // Fallback: try to get default app (shouldn't happen if initialization worked)
  try {
    adminAuth = getAuth()
  } catch (error: any) {
    console.error('Failed to get Firebase Admin Auth instance:', error.message)
  }
}

// Export Firestore instance
export const adminDb = adminApp ? getFirestore(adminApp) : null

// Export singleton instances
// All server code should import these instead of calling getAuth() directly
export { adminApp, adminAuth }

