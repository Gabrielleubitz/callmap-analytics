import { NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema, usageMetricsSchema } from '@/lib/schemas'
import { getTokenUsageFromJobs } from '@/lib/utils/tokens'
import { toDate, toFirestoreTimestamp } from '@/lib/utils/date'
import { calculateAvgTokensPerSession } from '@/lib/utils/metrics'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Usage Metrics API
 * 
 * Calculates token and cost metrics for the usage page:
 * - totalTokensIn: Sum of tokensIn from processingJobs within date range
 * - totalTokensOut: Sum of tokensOut from processingJobs within date range
 * - totalCost: Sum of costUsd from processingJobs within date range
 * - tokensByModel: Grouped tokens by model
 * - avgTokensPerSession: (totalTokensIn + totalTokensOut) / sessionCount
 * 
 * Data sources:
 * - Tokens/Cost: processingJobs collection (PRIMARY source of truth)
 * - Sessions: mindmaps collection (for session count)
 * 
 * Formula consistency:
 * - Uses getTokenUsageFromJobs() from lib/utils/tokens.ts
 * - Uses calculateAvgTokensPerSession() from lib/utils/metrics.ts
 * - All token calculations use the same utilities to prevent drift
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return errorResponse('Firebase Admin not initialized', 500)
    }

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    const body = await request.json()
    
    // Validate date range
    const dateRangeResult = dateRangeSchema.safeParse(body)
    if (!dateRangeResult.success) {
      return validationError(dateRangeResult.error)
    }
    
    const { start, end } = dateRangeResult.data

    // KPI 1-3: Token Usage (using shared utility)
    // Formula: Sum from processingJobs.tokensIn, processingJobs.tokensOut, processingJobs.costUsd
    // Fields: processingJobs.createdAt (filtered by date range)
    const tokenUsage = await getTokenUsageFromJobs(start, end)

    // KPI 4: Session Count
    // Formula: Count of mindmaps where createdAt is within date range
    // Field: mindmaps.createdAt
    let sessionCount = 0
    try {
      const startTimestamp = toFirestoreTimestamp(start)
      const endTimestamp = toFirestoreTimestamp(end)
      const mindmapsSnapshot = await db
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
      sessionCount = mindmapsSnapshot.size
    } catch (error) {
      // Fallback: Get all and filter client-side if index missing
      console.warn('[Usage Metrics] Missing index for mindmaps.createdAt query, using fallback')
      try {
        const allMindmaps = await db.collection(FIRESTORE_COLLECTIONS.sessions).get()
        sessionCount = allMindmaps.docs.filter((doc) => {
          const createdAt = toDate(doc.data().createdAt)
          return createdAt && createdAt >= start && createdAt <= end
        }).length
      } catch (e) {
        console.error('[Usage Metrics] Could not fetch session count:', e)
      }
    }

    // KPI 5: Average Tokens Per Session
    // Formula: (totalTokensIn + totalTokensOut) / sessionCount
    // Uses: calculateAvgTokensPerSession() from lib/utils/metrics.ts
    const avgTokensPerSession = calculateAvgTokensPerSession(
      tokenUsage.totalTokens,
      sessionCount
    )

    // Transform model map to array
    const tokensByModel = Array.from(tokenUsage.byModel.entries()).map(([model, tokens]) => ({
      model,
      tokens,
    }))

    const result = {
      totalTokensIn: tokenUsage.tokensIn,
      totalTokensOut: tokenUsage.tokensOut,
      tokensByModel,
      avgTokensPerSession,
      totalCost: tokenUsage.cost,
    }

    // Validate response shape
    const validatedResult = usageMetricsSchema.parse(result)

    return metricResponse(validatedResult, {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Usage Metrics] Error:', error)
    
    if (error.name === 'ZodError') {
      return errorResponse('Data validation failed', 500, error.errors, 'VALIDATION_ERROR')
    }
    
    return errorResponse(error.message || 'Failed to fetch usage metrics', 500, error.message)
  }
}

