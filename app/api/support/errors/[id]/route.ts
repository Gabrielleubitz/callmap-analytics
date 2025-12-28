/**
 * Support Error Detail & Update API
 * 
 * GET /api/support/errors/[id] - Get error details with triage
 * PATCH /api/support/errors/[id] - Update error (resolve, escalate, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { TriageStatus, ResolutionType } from '@/lib/types'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    // Get error
    const errorDoc = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrors)
      .doc(params.id)
      .get()

    if (!errorDoc.exists) {
      return NextResponse.json({ error: 'Error not found' }, { status: 404 })
    }

    const errorData = errorDoc.data()!
    const error = {
      id: errorDoc.id,
      ...errorData,
      first_seen_at: errorData.first_seen_at?.toDate() || new Date(),
      last_seen_at: errorData.last_seen_at?.toDate() || new Date(),
      created_at: errorData.created_at?.toDate() || new Date(),
      updated_at: errorData.updated_at?.toDate() || new Date(),
      acknowledged_at: errorData.acknowledged_at?.toDate() || null,
      resolved_at: errorData.resolved_at?.toDate() || null,
    }

    // Get triage result
    const triageSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrorTriage)
      .where('error_id', '==', params.id)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get()

    const triage = triageSnapshot.empty
      ? null
      : {
          id: triageSnapshot.docs[0].id,
          ...triageSnapshot.docs[0].data(),
          created_at: triageSnapshot.docs[0].data().created_at?.toDate() || new Date(),
        }

    return NextResponse.json({
      error,
      triage,
    })
  } catch (error: any) {
    console.error('[Support Error] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch error' },
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
    const {
      triage_status,
      resolution_type,
      resolution_notes,
      acknowledged,
    } = body

    const updateData: any = {
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (triage_status) {
      updateData.triage_status = triage_status as TriageStatus
    }

    if (resolution_type) {
      updateData.resolution_type = resolution_type as ResolutionType
      if (resolution_type !== 'ignored') {
        updateData.resolved_at = admin.firestore.FieldValue.serverTimestamp()
        updateData.resolved_by = decodedToken.uid
      }
    }

    if (resolution_notes !== undefined) {
      updateData.resolution_notes = resolution_notes
    }

    if (acknowledged === true) {
      updateData.acknowledged_at = admin.firestore.FieldValue.serverTimestamp()
    }

    await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrors)
      .doc(params.id)
      .update(updateData)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Support Error] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update error' },
      { status: 500 }
    )
  }
}

