import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { verifySessionCookie } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * POST /api/admin/revoke-access
 * 
 * Revokes admin access for a user (superAdmin only).
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { uid } = body

    if (!uid) {
      return NextResponse.json(
        { error: 'UID is required' },
        { status: 400 }
      )
    }

    const auth = getAuth()

    // Remove admin claims
    await auth.setCustomUserClaims(uid, {
      isAdmin: false,
      role: null,
    })

    // Revoke refresh tokens to force logout
    await auth.revokeRefreshTokens(uid)

    // SECURITY: Log audit trail for access revocation
    if (adminDb) {
      const auditLogRef = adminDb.collection('auditLogs').doc()
      const clientIp = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown'
      
      auditLogRef.set({
        action: 'revoke_admin_access',
        adminUserId: decodedToken.uid,
        adminEmail: decodedToken.email || null,
        targetUserId: uid,
        details: {
          revokedAt: new Date().toISOString(),
        },
        ipAddress: clientIp,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: request.headers.get('user-agent') || null,
      }).catch((error) => {
        console.error('[Admin Revoke Access] Error logging audit:', error)
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Revoke Access] Error:', error)
    return errorResponse(
      process.env.NODE_ENV === 'production' ? 'Failed to revoke access' : error.message,
      500
    )
  }
}

