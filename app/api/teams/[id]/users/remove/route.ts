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

    let decodedToken
    try {
      decodedToken = await verifySessionCookie(sessionCookie)
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

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
    const body = await request.json()
    const userId = body.userId as string | undefined

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const userRef = db.collection('users').doc(userId)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const data = userDoc.data() || {}
    const currentTeamId = data.workspaceId || data.teamId
    if (currentTeamId !== teamId) {
      return NextResponse.json(
        { error: 'User is not a member of this team' },
        { status: 400 }
      )
    }

    await userRef.update({
      workspaceId: null,
      teamId: null,
      status: 'disabled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[teams/users/remove] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove user from team' },
      { status: 500 }
    )
  }
}


