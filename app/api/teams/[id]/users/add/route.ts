import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'
import { captureException } from '@/lib/support/capture-error'

/**
 * Add an existing user (by email) to a team/workspace.
 *
 * - Looks up the user document by email
 * - Sets workspaceId/teamId on the user doc
 * - Optionally updates role
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let decodedToken: any = null
  let body: any = {}
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      decodedToken = await verifySessionCookie(sessionCookie)
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin/superAdmin can manage team members
    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    const db = adminDb
    const teamId = params.id
    body = await request.json()
    const email = (body.email || '').toLowerCase().trim()
    const role = body.role || 'member'

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find user by email
    const usersSnapshot = await db
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      return NextResponse.json({ error: 'User not found for this email' }, { status: 404 })
    }

    const userDoc = usersSnapshot.docs[0]
    const userRef = db.collection('users').doc(userDoc.id)

    // Update user profile with workspace metadata (legacy / analytics views)
    await userRef.update({
      workspaceId: teamId,
      teamId,
      role,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Also add to workspace members subcollection, which is the primary
    // source of truth in the mindmap app.
    const memberRef = db
      .collection('workspaces')
      .doc(teamId)
      .collection('members')
      .doc(userDoc.id)

    await memberRef.set(
      {
        userId: userDoc.id,
        role,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return NextResponse.json({ success: true, userId: userDoc.id })
  } catch (error: any) {
    console.error('[teams/users/add] Error:', error)
    
    // Capture error for support
    try {
      captureException(error, {
        app_area: 'invite_permissions',
        route: request.url,
        action: 'add_user_to_workspace',
        user_id: decodedToken?.uid || null,
        workspace_id: params.id,
        source: 'server',
        metadata: {
          email: body.email,
          role: body.role,
        },
      })
    } catch (captureErr) {
      // Ignore capture errors
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to add user to team' },
      { status: 500 }
    )
  }
}


