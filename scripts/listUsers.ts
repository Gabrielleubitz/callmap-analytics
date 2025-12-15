/**
 * List all Firebase users with their admin status
 * 
 * Usage:
 *   npx tsx scripts/listUsers.ts
 *   npx tsx scripts/listUsers.ts <email>
 */

import * as admin from 'firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import * as path from 'path'
import * as fs from 'fs'

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
      const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8')
      const serviceAccount = JSON.parse(serviceAccountJson)
      config.credential = admin.credential.cert(serviceAccount)
    }
    // Try to use service account from mindmap folder
    else {
      const mindmapServiceAccount = path.resolve(
        process.cwd(),
        '../mindmap/backend/service-account-key.json'
      )
      if (fs.existsSync(mindmapServiceAccount)) {
        const serviceAccountJson = fs.readFileSync(mindmapServiceAccount, 'utf8')
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

async function listUsers(searchEmail?: string) {
  const auth = getAuth()
  
  try {
    let allUsers: admin.auth.UserRecord[] = []
    let nextPageToken: string | undefined
    
    // List all users (paginated)
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken)
      allUsers = allUsers.concat(listUsersResult.users)
      nextPageToken = listUsersResult.pageToken
    } while (nextPageToken)

    // Filter by email if provided
    if (searchEmail) {
      const emailLower = searchEmail.toLowerCase()
      allUsers = allUsers.filter(u => u.email?.toLowerCase().includes(emailLower))
    }

    console.log(`\nFound ${allUsers.length} user(s):\n`)
    console.log('Email'.padEnd(40), 'UID'.padEnd(30), 'Admin'.padEnd(10), 'Role')
    console.log('-'.repeat(100))

    for (const user of allUsers) {
      const customClaims = user.customClaims || {}
      const isAdmin = customClaims.isAdmin === true
      const role = customClaims.role || 'none'
      
      console.log(
        (user.email || 'no email').padEnd(40),
        user.uid.padEnd(30),
        (isAdmin ? 'Yes' : 'No').padEnd(10),
        role
      )
    }

    // Show admin users separately
    const adminUsers = allUsers.filter(u => {
      const claims = u.customClaims || {}
      return claims.isAdmin === true
    })

    if (adminUsers.length > 0) {
      console.log(`\n\nAdmin users (${adminUsers.length}):`)
      adminUsers.forEach(u => {
        const claims = u.customClaims || {}
        console.log(`  - ${u.email} (${u.uid}): ${claims.role || 'admin'}`)
      })
    } else {
      console.log('\n\n⚠️  No admin users found!')
    }

  } catch (error: any) {
    console.error('Error listing users:', error.message)
    process.exit(1)
  }
}

// Run script
const args = process.argv.slice(2)
const searchEmail = args[0]
listUsers(searchEmail).then(() => {
  process.exit(0)
})

