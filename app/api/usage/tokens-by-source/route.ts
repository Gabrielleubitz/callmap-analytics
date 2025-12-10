import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    const sourceMap = new Map<string, number>()

    // Get mindmaps (sessions) and their source types
    try {
      const mindmapsSnapshot = await adminDb
        .collection('mindmaps')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()

      // For each mindmap, try to get associated processing jobs to calculate tokens
      for (const mindmapDoc of mindmapsSnapshot.docs) {
        const mindmapData = mindmapDoc.data()
        const sourceType = mindmapData.sourceType || mindmapData.source_type || 'upload'
        
        // Try to get tokens from associated processing jobs
        try {
          const jobsSnapshot = await adminDb
            .collection('processingJobs')
            .where('mindmapId', '==', mindmapDoc.id)
            .get()
          
          let tokens = 0
          jobsSnapshot.forEach((jobDoc) => {
            const jobData = jobDoc.data()
            tokens += (jobData.tokensIn || 0) + (jobData.tokensOut || 0)
          })
          
          sourceMap.set(sourceType, (sourceMap.get(sourceType) || 0) + tokens)
        } catch (error) {
          // If no jobs found, default to 0 tokens for this source
          sourceMap.set(sourceType, sourceMap.get(sourceType) || 0)
        }
      }
    } catch (error) {
      // If query fails, return empty
    }

    const result = Array.from(sourceMap.entries()).map(([source_type, tokens]) => ({
      source_type: source_type as any,
      tokens,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching tokens by source:', error)
    return NextResponse.json([])
  }
}

