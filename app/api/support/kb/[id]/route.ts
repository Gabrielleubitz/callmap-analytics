/**
 * Knowledge Base Entry Management
 * 
 * GET /api/support/kb/[id] - Get KB entry
 * PATCH /api/support/kb/[id] - Update KB entry
 * DELETE /api/support/kb/[id] - Delete KB entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { ErrorSeverity } from '@/lib/types'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

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

    const kbDoc = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrorKB)
      .doc(params.id)
      .get()

    if (!kbDoc.exists) {
      return NextResponse.json({ error: 'KB entry not found' }, { status: 404 })
    }

    const data = kbDoc.data()!
    return NextResponse.json({
      id: kbDoc.id,
      ...data,
      created_at: data.created_at?.toDate() || new Date(),
      updated_at: data.updated_at?.toDate() || new Date(),
    })
  } catch (error: any) {
    console.error('[KB] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch KB entry' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

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

    const body = await request.json()
    const updateData: any = {
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (body.error_pattern !== undefined) updateData.error_pattern = body.error_pattern
    if (body.symptoms !== undefined) updateData.symptoms = Array.isArray(body.symptoms) ? body.symptoms : [body.symptoms]
    if (body.app_area !== undefined) updateData.app_area = body.app_area || null
    if (body.expected !== undefined) updateData.expected = body.expected === true
    if (body.critical !== undefined) updateData.critical = body.critical === true
    if (body.severity !== undefined) updateData.severity = body.severity as ErrorSeverity
    if (body.root_causes !== undefined) updateData.root_causes = Array.isArray(body.root_causes) ? body.root_causes : [body.root_causes]
    if (body.fix_steps !== undefined) updateData.fix_steps = Array.isArray(body.fix_steps) ? body.fix_steps : [body.fix_steps]
    if (body.customer_message_template !== undefined) updateData.customer_message_template = body.customer_message_template

    await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrorKB)
      .doc(params.id)
      .update(updateData)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[KB] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update KB entry' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

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

    await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrorKB)
      .doc(params.id)
      .delete()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[KB] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete KB entry' },
      { status: 500 }
    )
  }
}

