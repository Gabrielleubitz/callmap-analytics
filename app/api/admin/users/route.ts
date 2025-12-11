import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/users
 * 
 * Lists all Firebase users (superAdmin only).
 */
export async function GET(request: NextRequest) {
  try {
    // Verify session and check for superAdmin role
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

    // Check if user is superAdmin
    if (decodedToken.role !== 'superAdmin') {
      return NextResponse.json(
        { error: 'Forbidden. SuperAdmin access required.' },
        { status: 403 }
      )
    }

    const auth = getAuth()
    
    // List all users (paginated)
    const listUsersResult = await auth.listUsers(1000) // Max 1000 users per page
    
    const users = await Promise.all(
      listUsersResult.users.map(async (userRecord) => {
        // Get custom claims
        const customClaims = userRecord.customClaims || {}
        const isAdmin = customClaims.isAdmin === true
        const role = customClaims.role || null

        // Check MFA status
        const mfaEnabled = (userRecord.multiFactor?.enrolledFactors?.length || 0) > 0

        // Get last login time (from metadata)
        const lastLogin = userRecord.metadata.lastSignInTime

        return {
          uid: userRecord.uid,
          email: userRecord.email || null,
          isAdmin,
          role,
          mfaEnabled,
          lastLogin: lastLogin || null,
          createdAt: userRecord.metadata.creationTime,
        }
      })
    )

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('[Admin Users] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

