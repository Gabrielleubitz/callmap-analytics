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

    let snapshot: admin.firestore.QuerySnapshot
    let filterCount = 0
    try {
      let query: admin.firestore.Query = adminDb
        .collection(FIRESTORE_COLLECTIONS.supportErrors)

      // Count how many filters we're applying
      if (expected !== undefined) {
        query = query.where('expected', '==', expected)
        filterCount++
      }
      if (critical !== undefined) {
        query = query.where('critical', '==', critical)
        filterCount++
      }
      if (severity) {
        query = query.where('severity', '==', severity as ErrorSeverity)
        filterCount++
      }
      if (app_area) {
        query = query.where('app_area', '==', app_area)
        filterCount++
      }
      if (user_id) {
        query = query.where('user_id', '==', user_id)
        filterCount++
      }
      if (workspace_id) {
        query = query.where('workspace_id', '==', workspace_id)
        filterCount++
      }
      if (triage_status) {
        query = query.where('triage_status', '==', triage_status as TriageStatus)
        filterCount++
      } else if (unresolved_only) {
        query = query.where('triage_status', 'in', ['pending', 'processing'])
        filterCount++
      }

      // Only add orderBy if we have 0-1 filters (to avoid composite index requirement)
      // If we have more filters, we'll sort in memory
      const needsInMemorySort = filterCount > 1
      if (!needsInMemorySort) {
        query = query.orderBy('last_seen_at', 'desc')
      }

      snapshot = await query.get()
    } catch (queryError: any) {
      // If query fails (e.g., missing index, collection doesn't exist), return empty results
      console.error('[Support Errors] Query error (may need Firestore index):', queryError)
      return NextResponse.json({
        items: [],
        total: 0,
        page: 1,
        pageSize: pageSize,
      })
    }
    
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

    // Sort by last_seen_at if we didn't use Firestore orderBy (when we have 2+ filters)
    const needsInMemorySort = filterCount > 1
    if (needsInMemorySort) {
      errors.sort((a, b) => {
        const aTime = a.last_seen_at?.getTime() || 0
        const bTime = b.last_seen_at?.getTime() || 0
        return bTime - aTime // Descending (most recent first)
      })
    }

    // Paginate
    const total = errors.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedErrors = errors.slice(startIndex, endIndex)

    return NextResponse.json({
      items: paginatedErrors,
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

