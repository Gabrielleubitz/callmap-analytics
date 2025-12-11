import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Export Rate (PDF/PNG)
 * 
 * Returns export statistics by type
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

    // Query export events
    const exportEventsSnapshot = await adminDb!
      .collection('analyticsEvents')
      .where('type', '==', 'mindmap_export')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    let totalExports = 0
    let successfulExports = 0
    let failedExports = 0
    const byExportType: Record<string, { total: number; success: number; failed: number }> = {}
    const exportsByMindmap: Record<string, number> = {}

    exportEventsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      totalExports++
      
      if (data.success) {
        successfulExports++
      } else {
        failedExports++
      }

      const exportType = data.exportType || 'unknown'
      if (!byExportType[exportType]) {
        byExportType[exportType] = { total: 0, success: 0, failed: 0 }
      }
      byExportType[exportType].total++
      if (data.success) {
        byExportType[exportType].success++
      } else {
        byExportType[exportType].failed++
      }

      const mindmapId = data.mindmapId
      if (mindmapId) {
        exportsByMindmap[mindmapId] = (exportsByMindmap[mindmapId] || 0) + 1
      }
    })

    // Get total mindmaps in period for export rate calculation
    const mindmapsSnapshot = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.sessions)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    const totalMindmaps = mindmapsSnapshot.size
    const exportedMindmaps = Object.keys(exportsByMindmap).length
    const exportRate = totalMindmaps > 0
      ? (exportedMindmaps / totalMindmaps) * 100
      : 0

    return metricResponse({
      totalExports,
      successfulExports,
      failedExports,
      totalMindmaps,
      exportedMindmaps,
      exportRate: Math.round(exportRate * 100) / 100,
      byExportType,
      avgExportsPerMindmap: exportedMindmaps > 0
        ? Math.round((totalExports / exportedMindmaps) * 100) / 100
        : 0,
    })
  } catch (error: any) {
    console.error('[analytics/export-rate] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

