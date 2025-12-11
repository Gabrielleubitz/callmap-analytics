/**
 * Admin role management script
 * 
 * Usage:
 *   npx ts-node scripts/setAdminRole.ts <uid> <role>
 *   npx ts-node scripts/setAdminRole.ts <uid> remove
 * 
 * Examples:
 *   npx ts-node scripts/setAdminRole.ts abc123 superAdmin
 *   npx ts-node scripts/setAdminRole.ts abc123 admin
 *   npx ts-node scripts/setAdminRole.ts abc123 remove
 */

import * as admin from 'firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import * as path from 'path'

// Initialize Firebase Admin
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
      const serviceAccountJson = require('fs').readFileSync(serviceAccountPath, 'utf8')
      const serviceAccount = JSON.parse(serviceAccountJson)
      config.credential = admin.credential.cert(serviceAccount)
    }
    // Try to use service account from mindmap folder
    else {
      const mindmapServiceAccount = path.resolve(
        process.cwd(),
        '../mindmap/backend/service-account-key.json'
      )
      if (require('fs').existsSync(mindmapServiceAccount)) {
        const serviceAccountJson = require('fs').readFileSync(mindmapServiceAccount, 'utf8')
        const serviceAccount = JSON.parse(serviceAccountJson)
        config.credential = admin.credential.cert(serviceAccount)
      } else {
        throw new Error('No service account found')
      }
    }

    admin.initializeApp(config)
    console.log('Firebase Admin initialized successfully')
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', error.message)
    process.exit(1)
  }
}

async function setAdminRole(uid: string, role: string | 'remove') {
  const auth = getAuth()

  try {
    if (role === 'remove') {
      // Remove admin privileges
      await auth.setCustomUserClaims(uid, {
        isAdmin: false,
        role: null,
      })
      
      // Revoke refresh tokens to force logout
      await auth.revokeRefreshTokens(uid)
      
      console.log(`✓ Removed admin privileges from user ${uid}`)
    } else {
      // Set admin role
      await auth.setCustomUserClaims(uid, {
        isAdmin: true,
        role: role,
      })
      
      console.log(`✓ Set admin role "${role}" for user ${uid}`)
    }

    // Get user to verify
    const user = await auth.getUser(uid)
    console.log(`User email: ${user.email}`)
    console.log(`Custom claims:`, user.customClaims)
  } catch (error: any) {
    console.error('Error setting admin role:', error.message)
    process.exit(1)
  }
}

// Run script
const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('Usage: npx ts-node scripts/setAdminRole.ts <uid> <role|remove>')
  console.error('  role: superAdmin | admin')
  process.exit(1)
}

const [uid, role] = args
setAdminRole(uid, role).then(() => {
  process.exit(0)
})

