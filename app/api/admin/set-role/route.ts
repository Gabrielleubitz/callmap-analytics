import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { verifySessionCookie } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * POST /api/admin/set-role
 * 
 * Sets admin role for a user (superAdmin only).
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
    const { uid, role } = body

    if (!uid || !role) {
      return NextResponse.json(
        { error: 'UID and role are required' },
        { status: 400 }
      )
    }

    if (!['admin', 'superAdmin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "superAdmin"' },
        { status: 400 }
      )
    }

    const auth = getAuth()

    // Set custom claims
    await auth.setCustomUserClaims(uid, {
      isAdmin: true,
      role: role,
    })

    // SECURITY: Log audit trail for role changes
    if (adminDb) {
      const auditLogRef = adminDb.collection('auditLogs').doc()
      const clientIp = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown'
      
      auditLogRef.set({
        action: 'set_admin_role',
        adminUserId: decodedToken.uid,
        adminEmail: decodedToken.email || null,
        targetUserId: uid,
        details: {
          role,
        },
        ipAddress: clientIp,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: request.headers.get('user-agent') || null,
      }).catch((error) => {
        console.error('[Admin Set Role] Error logging audit:', error)
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Set Role] Error:', error)
    return errorResponse(
      process.env.NODE_ENV === 'production' ? 'Failed to set role' : error.message,
      500
    )
  }
}

