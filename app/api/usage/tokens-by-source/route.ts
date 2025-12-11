import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { extractTokenUsageFromJob, calculateTotalTokens } from '@/lib/utils/tokens'
import { toDate, toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'

/**
 * Tokens by Source Type API
 * 
 * Returns token usage grouped by session source type (call, meeting, upload, url).
 * 
 * Formula: For each session (mindmap), get its sourceType, then sum tokens from all
 *          processingJobs associated with that session (where mindmapId matches)
 * Fields: mindmaps.sourceType, mindmaps.createdAt, processingJobs.mindmapId, processingJobs.tokensIn, processingJobs.tokensOut
 * 
 * Note: This groups by session source type, not job type. Multiple jobs can belong to one session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate date range
    const dateRangeResult = dateRangeSchema.safeParse(body)
    if (!dateRangeResult.success) {
      return NextResponse.json(
        { error: 'Invalid date range', details: dateRangeResult.error.errors },
        { status: 400 }
      )
    }
    
    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    const sourceMap = new Map<string, number>()

    // Get mindmaps (sessions) in date range
    let mindmapsSnapshot
    try {
      mindmapsSnapshot = await adminDb
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // Fallback: Get all and filter if index missing
      console.warn('[Tokens by Source] Missing index for mindmaps.createdAt query, using fallback')
      try {
        const allMindmaps = await adminDb.collection(FIRESTORE_COLLECTIONS.sessions).get()
        mindmapsSnapshot = {
          docs: allMindmaps.docs.filter((doc) => {
            const createdAt = toDate(doc.data().createdAt)
            return createdAt && createdAt >= start && createdAt <= end
          }),
        } as any
      } catch (e) {
        return NextResponse.json([])
      }
    }

    // For each session, get its source type and sum tokens from associated jobs
    for (const mindmapDoc of mindmapsSnapshot.docs) {
      const mindmapData = mindmapDoc.data()
      const sourceType = mindmapData.sourceType || mindmapData.source_type || 'upload'
      
      // Get tokens from associated processing jobs
      try {
        const jobsSnapshot = await adminDb
          .collection(FIRESTORE_COLLECTIONS.aiJobs)
          .where('mindmapId', '==', mindmapDoc.id)
          .get()
        
        let tokens = 0
        for (const jobDoc of jobsSnapshot.docs) {
          const usage = extractTokenUsageFromJob(jobDoc.data())
          tokens += calculateTotalTokens(usage.tokensIn, usage.tokensOut)
        }
        
        sourceMap.set(sourceType, (sourceMap.get(sourceType) || 0) + tokens)
      } catch (error) {
        // If no jobs found or query fails, default to 0 tokens for this source
        sourceMap.set(sourceType, sourceMap.get(sourceType) || 0)
      }
    }

    const result = Array.from(sourceMap.entries()).map(([source_type, tokens]) => ({
      source_type: source_type as any,
      tokens,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Tokens by Source] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tokens by source' },
      { status: 500 }
    )
  }
}

