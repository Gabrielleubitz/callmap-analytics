import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * File to Map Conversion Success Rate
 * 
 * Returns success/failure rates for file conversions
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

    // Query conversion events
    const conversionEventsSnapshot = await adminDb!
      .collection('analyticsEvents')
      .where('type', '==', 'file_conversion')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    let totalConversions = 0
    let successfulConversions = 0
    let failedConversions = 0
    const byFileType: Record<string, { total: number; success: number; failed: number }> = {}
    const errorMessages: Record<string, number> = {}

    conversionEventsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      totalConversions++
      
      if (data.success) {
        successfulConversions++
      } else {
        failedConversions++
        const errorMsg = data.errorMessage || 'Unknown error'
        errorMessages[errorMsg] = (errorMessages[errorMsg] || 0) + 1
      }

      const fileType = data.fileType || 'unknown'
      if (!byFileType[fileType]) {
        byFileType[fileType] = { total: 0, success: 0, failed: 0 }
      }
      byFileType[fileType].total++
      if (data.success) {
        byFileType[fileType].success++
      } else {
        byFileType[fileType].failed++
      }
    })

    const successRate = totalConversions > 0
      ? (successfulConversions / totalConversions) * 100
      : 0

    return metricResponse({
      totalConversions,
      successfulConversions,
      failedConversions,
      successRate: Math.round(successRate * 100) / 100,
      byFileType,
      topErrors: Object.entries(errorMessages)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([error, count]) => ({ error, count })),
    })
  } catch (error: any) {
    console.error('[analytics/file-conversion-rate] Error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal server error'
    return errorResponse(errorMessage, 500, { name: error?.name, code: error?.code })
  }
}

