import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const limitCount = body.limit || 10

    let jobsSnapshot
    try {
      // Try query with index
      jobsSnapshot = await adminDb
        .collection('processingJobs')
        .where('status', '==', 'failed')
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get()
    } catch (error: any) {
      // If index doesn't exist, get all and filter client-side
      const allJobs = await adminDb
        .collection('processingJobs')
        .orderBy('createdAt', 'desc')
        .limit(100) // Get more to filter
        .get()
      
      jobsSnapshot = {
        docs: allJobs.docs
          .filter((doc) => {
            const data = doc.data()
            return data.status === 'failed'
          })
          .slice(0, limitCount),
      } as any
    }

    const result = jobsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        session_id: data.sessionId || data.mindmapId || data.documentId || null,
        type: (data.type || 'transcribe') as any,
        status: 'failed' as any,
        started_at: toDate(data.startedAt),
        finished_at: toDate(data.finishedAt) || toDate(data.completedAt),
        tokens_in: data.tokensIn || null,
        tokens_out: data.tokensOut || null,
        cost_usd: data.costUsd || data.cost || null,
        error_message: data.error?.message || data.errorMessage || data.error || 'Unknown error',
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching recent failed jobs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recent failed jobs' },
      { status: 500 }
    )
  }
}

