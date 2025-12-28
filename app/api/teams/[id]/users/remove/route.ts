import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'

/**
 * Remove a user from a team/workspace.
 *
 * This detaches the workspaceId/teamId from the user document and
 * marks the user as disabled in this workspace context.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      // SECURITY: Log permission denial
      const { logPermissionDenied } = await import('@/lib/auth/security-log')
      await logPermissionDenied(
        authResult.decodedToken?.uid || null,
        'remove_team_member',
        `team:${params.id}`,
        request
      )
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    const db = adminDb
    const teamId = params.id
    const body = await request.json()
    const userId = body.userId as string | undefined

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Check workspace membership
    const memberRef = db
      .collection('workspaces')
      .doc(teamId)
      .collection('members')
      .doc(userId)
    const memberDoc = await memberRef.get()

    if (!memberDoc.exists) {
      return NextResponse.json(
        { error: 'User is not a member of this team' },
        { status: 404 }
      )
    }

    // Remove from members subcollection (primary membership source)
    await memberRef.delete()

    // Also clear workspace metadata on user doc for analytics / legacy views
    const userRef = db.collection('users').doc(userId)
    const userDoc = await userRef.get()
    if (userDoc.exists) {
      await userRef.update({
        workspaceId: null,
        teamId: null,
        status: 'disabled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[teams/users/remove] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove user from team' },
      { status: 500 }
    )
  }
}


