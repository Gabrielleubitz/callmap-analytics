import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Team Collaboration Activity
 * 
 * Returns collaboration metrics (notes, mentions, reactions, etc.)
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse(body)

    if (!dateRangeResult.success) {
      return validationError(dateRangeResult.error)
    }

    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Query collaboration events
    const collaborationEventsSnapshot = await adminDb!
      .collection('analyticsEvents')
      .where('type', '==', 'collaboration')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    const byActivityType: Record<string, number> = {
      note_added: 0,
      note_edited: 0,
      mention: 0,
      reaction: 0,
      comment: 0,
    }

    const byWorkspace: Record<string, number> = {}
    const activeCollaborators: Set<string> = new Set()
    const activeMindmaps: Set<string> = new Set()

    collaborationEventsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      const activityType = data.activityType || 'other'
      const workspaceId = data.workspaceId
      const userId = data.userId
      const mindmapId = data.mindmapId

      if (byActivityType.hasOwnProperty(activityType)) {
        byActivityType[activityType]++
      }

      if (workspaceId) {
        byWorkspace[workspaceId] = (byWorkspace[workspaceId] || 0) + 1
      }

      if (userId) {
        activeCollaborators.add(userId)
      }

      if (mindmapId) {
        activeMindmaps.add(mindmapId)
      }
    })

    return metricResponse({
      totalCollaborationEvents: collaborationEventsSnapshot.size,
      byActivityType,
      byWorkspace,
      activeCollaborators: activeCollaborators.size,
      activeMindmaps: activeMindmaps.size,
      avgEventsPerMindmap: activeMindmaps.size > 0
        ? Math.round((collaborationEventsSnapshot.size / activeMindmaps.size) * 100) / 100
        : 0,
    })
  } catch (error: any) {
    console.error('[analytics/collaboration-activity] Error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal server error'
    return errorResponse(errorMessage, 500, { name: error?.name, code: error?.code })
  }
}

