import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { extractTokenUsageFromJob } from '@/lib/utils/tokens'
import { toDate, toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { validationError } from '@/lib/utils/api-response'

/**
 * Most Expensive Sessions API
 * 
 * Returns the top N sessions by cost within a date range.
 * 
 * Formula: Group processingJobs by sessionId (mindmapId), sum costUsd per session, sort by cost descending
 * Fields: processingJobs.mindmapId (or sessionId/documentId), processingJobs.costUsd, processingJobs.createdAt
 * 
 * Note: Sessions are identified by mindmapId in processingJobs. Multiple jobs can belong to one session.
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
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
    const limit = body.limit || 10
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Get processing jobs in range
    let jobsSnapshot
    try {
      jobsSnapshot = await db
        .collection(FIRESTORE_COLLECTIONS.aiJobs)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // Fallback: Get all and filter if index missing
      console.warn('[Expensive Sessions] Missing index for processingJobs.createdAt query, using fallback')
      const allJobs = await db.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
      jobsSnapshot = {
        docs: allJobs.docs.filter((doc) => {
          const createdAt = toDate(doc.data().createdAt)
          return createdAt && createdAt >= start && createdAt <= end
        }),
      } as any
    }

    // Group by session/mindmap and calculate total cost
    // Formula: Sum costUsd for all jobs with the same mindmapId
    const sessionCosts = new Map<string, {
      id: string
      source_type: string
      tokens_in: number
      tokens_out: number
      cost_usd: number
    }>()

    for (const doc of jobsSnapshot.docs) {
      const data = doc.data()
      const sessionId = data.mindmapId || data.sessionId || data.documentId || doc.id
      const sourceType = data.sourceType || 'upload'
      
      // Extract token usage using shared utility
      const usage = extractTokenUsageFromJob(data)

      if (!sessionCosts.has(sessionId)) {
        sessionCosts.set(sessionId, {
          id: sessionId,
          source_type: sourceType,
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
        })
      }

      const session = sessionCosts.get(sessionId)!
      session.tokens_in += usage.tokensIn
      session.tokens_out += usage.tokensOut
      session.cost_usd += usage.cost
    }

    // Sort by cost descending and take top N
    const result = Array.from(sessionCosts.values())
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, limit)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Expensive Sessions] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch expensive sessions' },
      { status: 500 }
    )
  }
}

