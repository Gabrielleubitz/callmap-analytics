import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'

/**
 * Update a user's role within a team/workspace.
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
    const role = body.role as string | undefined

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
    }

    // Ensure workspace membership exists
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

    // Update workspace member role (source of truth for workspace)
    await memberRef.update({ role })

    // Also reflect role on user document for analytics / legacy queries
    const userRef = db.collection('users').doc(userId)
    const userDoc = await userRef.get()
    if (userDoc.exists) {
      await userRef.update({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[teams/users/update-role] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user role' },
      { status: 500 }
    )
  }
}


