import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)
    const limitCount = body.limit || 10
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    // Get all workspaces
    const workspacesSnapshot = await adminDb.collection('workspaces').get()
    const workspaceMap = new Map<string, string>()
    workspacesSnapshot.forEach((doc) => {
      workspaceMap.set(doc.id, doc.data().name || doc.id)
    })

    // Get processing jobs in range - handle missing index
    let jobsSnapshot
    try {
      jobsSnapshot = await adminDb
        .collection('processingJobs')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, get all jobs and filter client-side
      const allJobs = await adminDb.collection('processingJobs').get()
      jobsSnapshot = {
        docs: allJobs.docs.filter((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }),
        forEach: function(callback: any) {
          this.docs.forEach(callback)
        }
      } as any
    }

    // Calculate tokens per workspace
    const workspaceTokens = new Map<string, number>()
    jobsSnapshot.forEach((doc) => {
      const data = doc.data()
      const workspaceId = data.workspaceId || data.workspace_id
      if (workspaceId && workspaceMap.has(workspaceId)) {
        const tokens = (data.tokensIn || 0) + (data.tokensOut || 0)
        workspaceTokens.set(workspaceId, (workspaceTokens.get(workspaceId) || 0) + tokens)
      }
    })

    const result = Array.from(workspaceTokens.entries())
      .map(([team_id, tokens]) => ({
        team_id,
        team_name: workspaceMap.get(team_id) || team_id,
        tokens,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, limitCount)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching top teams by tokens:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top teams by tokens' },
      { status: 500 }
    )
  }
}

