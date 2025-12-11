import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Mindmap Edit Count Metrics
 * 
 * Returns edit statistics for mindmaps
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Database not initialized'), { status: 500 })
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse(body)

    if (!dateRangeResult.success) {
      return NextResponse.json(validationError(dateRangeResult.error), { status: 400 })
    }

    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Query mindmaps with edits in date range
    const mindmapsSnapshot = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.sessions)
      .where('lastEditedAt', '>=', startTimestamp)
      .where('lastEditedAt', '<=', endTimestamp)
      .get()

    let totalEdits = 0
    let mindmapsWithEdits = 0
    const editCounts: number[] = []
    const byEditType: Record<string, number> = {
      layout: 0,
      outline: 0,
      title: 0,
      other: 0,
    }

    // Also query analytics events for edit type breakdown
    const editEventsSnapshot = await adminDb!
      .collection('analyticsEvents')
      .where('type', '==', 'mindmap_edit')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    editEventsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      const editType = data.editType || 'other'
      byEditType[editType] = (byEditType[editType] || 0) + 1
    })

    mindmapsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      const editCount = data.editCount || 0
      
      if (editCount > 0) {
        totalEdits += editCount
        mindmapsWithEdits++
        editCounts.push(editCount)
      }
    })

    const avgEditsPerMindmap = mindmapsWithEdits > 0
      ? totalEdits / mindmapsWithEdits
      : 0

    return metricResponse({
      totalEdits,
      mindmapsWithEdits,
      avgEditsPerMindmap: Math.round(avgEditsPerMindmap * 100) / 100,
      maxEdits: editCounts.length > 0 ? Math.max(...editCounts) : 0,
      byEditType,
    })
  } catch (error: any) {
    console.error('[analytics/mindmap-edit-count] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

