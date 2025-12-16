/**
 * List Support Errors API
 * 
 * POST /api/support/errors/list
 * 
 * Returns paginated list of errors with filters.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { SupportErrorEvent, TriageStatus, ErrorSeverity } from '@/lib/types'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
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
      page = 1,
      pageSize = 20,
      expected,
      critical,
      severity,
      app_area,
      user_id,
      workspace_id,
      triage_status,
      unresolved_only = false,
    } = body

    let query: admin.firestore.Query = adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrors)

    // Apply filters
    if (expected !== undefined) {
      query = query.where('expected', '==', expected)
    }
    if (critical !== undefined) {
      query = query.where('critical', '==', critical)
    }
    if (severity) {
      query = query.where('severity', '==', severity as ErrorSeverity)
    }
    if (app_area) {
      query = query.where('app_area', '==', app_area)
    }
    if (user_id) {
      query = query.where('user_id', '==', user_id)
    }
    if (workspace_id) {
      query = query.where('workspace_id', '==', workspace_id)
    }
    if (triage_status) {
      query = query.where('triage_status', '==', triage_status as TriageStatus)
    } else if (unresolved_only) {
      query = query.where('triage_status', 'in', ['pending', 'processing'])
    }

    // Order by last seen (most recent first)
    query = query.orderBy('last_seen_at', 'desc')

    const snapshot = await query.get()
    
    let errors = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        first_seen_at: data.first_seen_at?.toDate() || new Date(),
        last_seen_at: data.last_seen_at?.toDate() || new Date(),
        created_at: data.created_at?.toDate() || new Date(),
        updated_at: data.updated_at?.toDate() || new Date(),
        acknowledged_at: data.acknowledged_at?.toDate() || null,
        resolved_at: data.resolved_at?.toDate() || null,
      } as SupportErrorEvent
    })

    // Paginate
    const total = errors.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedErrors = errors.slice(startIndex, endIndex)

    return NextResponse.json({
      data: paginatedErrors,
      total,
      page,
      pageSize,
    })
  } catch (error: any) {
    console.error('[Support Errors] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list errors' },
      { status: 500 }
    )
  }
}

