import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

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
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const type = body.type
    const status = body.status
    const teamId = body.teamId
    const start = body.start ? new Date(body.start) : null
    const end = body.end ? new Date(body.end) : null

    // Get processing jobs
    let jobsSnapshot
    try {
      if (start && end) {
        const startTimestamp = admin.firestore.Timestamp.fromDate(start)
        const endTimestamp = admin.firestore.Timestamp.fromDate(end)
        jobsSnapshot = await adminDb
          .collection('processingJobs')
          .where('createdAt', '>=', startTimestamp)
          .where('createdAt', '<=', endTimestamp)
          .get()
      } else {
        jobsSnapshot = await adminDb.collection('processingJobs').get()
      }
    } catch (error) {
      // If query fails, get all and filter
      const allJobs = await adminDb.collection('processingJobs').get()
      jobsSnapshot = {
        docs: allJobs.docs.filter((doc) => {
          if (!start || !end) return true
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }),
      } as any
    }

    let jobs = jobsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        session_id: data.sessionId || data.mindmapId || data.documentId || null,
        type: (data.type || 'transcribe') as any,
        status: (data.status || 'completed') as any,
        started_at: toDate(data.startedAt),
        finished_at: toDate(data.finishedAt || data.completedAt),
        tokens_in: data.tokensIn || null,
        tokens_out: data.tokensOut || null,
        cost_usd: data.costUsd || data.cost || null,
        error_message: data.error?.message || data.errorMessage || data.error || null,
      }
    })

    // Apply filters
    if (type && type.length > 0) {
      jobs = jobs.filter((j) => type.includes(j.type))
    }

    if (status && status.length > 0) {
      jobs = jobs.filter((j) => status.includes(j.status))
    }

    if (teamId) {
      // Filter by workspaceId in jobs or get from session
      jobs = jobs.filter((j) => {
        // This would require checking the session/workspace relationship
        // For now, we'll skip this filter if teamId is provided
        return true
      })
    }

    const total = jobs.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedJobs = jobs.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedJobs, total })
  } catch (error: any) {
    console.error('Error fetching AI jobs:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

