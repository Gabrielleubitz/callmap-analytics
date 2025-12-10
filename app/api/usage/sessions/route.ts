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
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const teamId = body.teamId
    const model = body.model
    const sourceType = body.sourceType
    const status = body.status

    // Get all mindmaps (sessions)
    let mindmapsSnapshot
    try {
      mindmapsSnapshot = await adminDb.collection('mindmaps').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    // Transform to sessions
    let allSessions = mindmapsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || null,
        user_id: data.userId || null,
        source_type: (data.sourceType || data.source_type || 'upload') as any,
        status: (data.status || 'ready') as any,
        duration_seconds: data.durationSeconds || data.duration || null,
        chars_in: data.charsIn || null,
        tokens_in: null as number | null,
        tokens_out: null as number | null,
        model: null as string | null,
        cost_usd: null as number | null,
        created_at: toDate(data.createdAt),
      }
    })

    // Get tokens and cost from processing jobs
    const jobsSnapshot = await adminDb.collection('processingJobs').get()
    const jobsByMindmap = new Map<string, any[]>()
    jobsSnapshot.forEach((jobDoc) => {
      const jobData = jobDoc.data()
      const mindmapId = jobData.mindmapId || jobData.sessionId || jobData.documentId
      if (mindmapId) {
        if (!jobsByMindmap.has(mindmapId)) {
          jobsByMindmap.set(mindmapId, [])
        }
        jobsByMindmap.get(mindmapId)!.push(jobData)
      }
    })

    // Aggregate tokens and cost per session
    allSessions = allSessions.map((session) => {
      const jobs = jobsByMindmap.get(session.id) || []
      let tokensIn = 0
      let tokensOut = 0
      let cost = 0
      let model: string | null = null

      jobs.forEach((job) => {
        tokensIn += job.tokensIn || 0
        tokensOut += job.tokensOut || 0
        cost += job.costUsd || job.cost || 0
        if (job.model && !model) model = job.model
      })

      return {
        ...session,
        tokens_in: tokensIn || null,
        tokens_out: tokensOut || null,
        model,
        cost_usd: cost || null,
      }
    })

    // Apply filters
    if (teamId) {
      allSessions = allSessions.filter((s) => s.team_id === teamId)
    }

    if (model) {
      allSessions = allSessions.filter((s) => s.model === model)
    }

    if (sourceType) {
      allSessions = allSessions.filter((s) => s.source_type === sourceType)
    }

    if (status) {
      allSessions = allSessions.filter((s) => s.status === status)
    }

    const total = allSessions.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedSessions = allSessions.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedSessions, total })
  } catch (error: any) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

