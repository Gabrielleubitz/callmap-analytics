import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Steps per Map (Funnel Tracking)
 * 
 * Returns funnel conversion rates for mindmap creation flow
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

    // Query funnel events
    const funnelEventsSnapshot = await adminDb!
      .collection('analyticsEvents')
      .where('type', '==', 'mindmap_funnel')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    const stepCounts: Record<string, number> = {
      upload: 0,
      process: 0,
      generate: 0,
      view: 0,
      edit: 0,
      export: 0,
    }

    // Track unique users/mindmaps per step
    const usersByStep: Record<string, Set<string>> = {
      upload: new Set(),
      process: new Set(),
      generate: new Set(),
      view: new Set(),
      edit: new Set(),
      export: new Set(),
    }

    const mindmapsByStep: Record<string, Set<string>> = {
      upload: new Set(),
      process: new Set(),
      generate: new Set(),
      view: new Set(),
      edit: new Set(),
      export: new Set(),
    }

    funnelEventsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      const step = data.step
      const userId = data.userId
      const mindmapId = data.mindmapId

      if (step && stepCounts.hasOwnProperty(step)) {
        stepCounts[step]++
        if (userId) usersByStep[step].add(userId)
        if (mindmapId) mindmapsByStep[step].add(mindmapId)
      }
    })

    // Calculate conversion rates
    const uploadCount = stepCounts.upload
    const processCount = stepCounts.process
    const generateCount = stepCounts.generate
    const viewCount = stepCounts.view
    const editCount = stepCounts.edit
    const exportCount = stepCounts.export

    const uploadToProcess = uploadCount > 0 ? (processCount / uploadCount) * 100 : 0
    const processToGenerate = processCount > 0 ? (generateCount / processCount) * 100 : 0
    const generateToView = generateCount > 0 ? (viewCount / generateCount) * 100 : 0
    const viewToEdit = viewCount > 0 ? (editCount / viewCount) * 100 : 0
    const viewToExport = viewCount > 0 ? (exportCount / viewCount) * 100 : 0

    return metricResponse({
      stepCounts,
      uniqueUsersByStep: Object.fromEntries(
        Object.entries(usersByStep).map(([step, users]) => [step, users.size])
      ),
      uniqueMindmapsByStep: Object.fromEntries(
        Object.entries(mindmapsByStep).map(([step, mindmaps]) => [step, mindmaps.size])
      ),
      conversionRates: {
        uploadToProcess: Math.round(uploadToProcess * 100) / 100,
        processToGenerate: Math.round(processToGenerate * 100) / 100,
        generateToView: Math.round(generateToView * 100) / 100,
        viewToEdit: Math.round(viewToEdit * 100) / 100,
        viewToExport: Math.round(viewToExport * 100) / 100,
      },
    })
  } catch (error: any) {
    console.error('[analytics/mindmap-funnel] Error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal server error'
    return errorResponse(errorMessage, 500, { name: error?.name, code: error?.code })
  }
}

