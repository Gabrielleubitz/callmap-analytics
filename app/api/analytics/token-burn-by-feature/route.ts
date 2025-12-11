import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Token Burn per Feature
 * 
 * Returns token usage broken down by feature type
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

    // Query token burn events
    const tokenBurnEventsSnapshot = await adminDb!
      .collection('analyticsEvents')
      .where('type', '==', 'token_burn')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    const byFeature: Record<string, { total: number; count: number; avg: number }> = {}
    let totalTokens = 0
    let totalEvents = 0

    tokenBurnEventsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      const feature = data.feature || 'other'
      const tokensUsed = data.tokensUsed || 0

      totalTokens += tokensUsed
      totalEvents++

      if (!byFeature[feature]) {
        byFeature[feature] = { total: 0, count: 0, avg: 0 }
      }
      byFeature[feature].total += tokensUsed
      byFeature[feature].count++
    })

    // Calculate averages
    Object.keys(byFeature).forEach(feature => {
      const data = byFeature[feature]
      data.avg = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0
    })

    // Calculate percentages
    const byFeaturePercent: Record<string, number> = {}
    Object.keys(byFeature).forEach(feature => {
      byFeaturePercent[feature] = totalTokens > 0
        ? Math.round((byFeature[feature].total / totalTokens) * 100 * 100) / 100
        : 0
    })

    return metricResponse({
      totalTokens,
      totalEvents,
      avgTokensPerEvent: totalEvents > 0
        ? Math.round((totalTokens / totalEvents) * 100) / 100
        : 0,
      byFeature,
      byFeaturePercent,
    })
  } catch (error: any) {
    console.error('[analytics/token-burn-by-feature] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

