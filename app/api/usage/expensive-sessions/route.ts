import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)
    const limit = body.limit || 10
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    // Get processing jobs in range
    let jobsSnapshot
    try {
      jobsSnapshot = await adminDb
        .collection('processingJobs')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, get all and filter
      const allJobs = await adminDb.collection('processingJobs').get()
      jobsSnapshot = {
        docs: allJobs.docs.filter((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }),
      } as any
    }

    // Group by session/mindmap and calculate total cost
    const sessionCosts = new Map<string, any>()

    jobsSnapshot.forEach((doc) => {
      const data = doc.data()
      const sessionId = data.mindmapId || data.sessionId || data.documentId || doc.id
      const cost = data.costUsd || data.cost || 0
      const tokensIn = data.tokensIn || 0
      const tokensOut = data.tokensOut || 0
      const sourceType = data.sourceType || 'upload'

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
      session.tokens_in += tokensIn
      session.tokens_out += tokensOut
      session.cost_usd += cost
    })

    // Sort by cost and take top N
    const result = Array.from(sessionCosts.values())
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, limit)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching expensive sessions:', error)
    return NextResponse.json([])
  }
}

