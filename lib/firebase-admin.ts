import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const config: admin.AppOptions = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mindmap-ec9bc',
    }

    // Try to use service account from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      config.credential = admin.credential.cert(serviceAccount)
    } 
    // Try to use service account file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8')
        const serviceAccount = JSON.parse(serviceAccountJson)
        config.credential = admin.credential.cert(serviceAccount)
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
        config.credential = admin.credential.cert(serviceAccount)
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use Google Application Default Credentials
        config.credential = admin.credential.applicationDefault()
      }
    }

    admin.initializeApp(config)
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
}

export const adminDb = admin.firestore()

