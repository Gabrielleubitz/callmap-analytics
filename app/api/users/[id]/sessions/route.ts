import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb) {
      return NextResponse.json({ data: [], total: 0 })
    }

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    const userId = params.id
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20

    // Get mindmaps (sessions) for this user
    let mindmapsSnapshot: admin.firestore.QuerySnapshot
    try {
      mindmapsSnapshot = await db
        .collection('mindmaps')
        .where('userId', '==', userId)
        .get()
    } catch (error) {
      // If query fails, get all and filter
      const allMindmaps = await db.collection('mindmaps').get()
      const filteredDocs = allMindmaps.docs.filter((doc: QueryDocumentSnapshot) => {
        const data = doc.data()
        return data.userId === userId
      })
      mindmapsSnapshot = {
        ...allMindmaps,
        docs: filteredDocs,
      } as admin.firestore.QuerySnapshot
    }

    // Transform to sessions
    let sessions = mindmapsSnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || null,
        user_id: userId,
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
    const jobsSnapshot = await db.collection('processingJobs').get()
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
    sessions = sessions.map((session) => {
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

    const total = sessions.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedSessions = sessions.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedSessions, total })
  } catch (error: any) {
    console.error('Error fetching user sessions:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

