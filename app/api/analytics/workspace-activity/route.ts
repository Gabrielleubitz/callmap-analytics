import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Workspace Activity Analytics API
 * 
 * Provides detailed workspace-level activity metrics:
 * - Active workspaces (with activity in date range)
 * - Mindmaps per workspace
 * - Users per workspace
 * - Token usage per workspace
 * - Collaboration activity per workspace
 */

interface WorkspaceActivityAnalytics {
  activeWorkspaces: number
  workspaces: Array<{
    workspaceId: string
    workspaceName: string
    plan: string
    memberCount: number
    mindmapCount: number
    tokenUsage: number
    cost: number
    collaborationCount: number
    lastActivityAt: string | null
  }>
  topWorkspacesByActivity: Array<{
    workspaceId: string
    workspaceName: string
    activityScore: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse(body)

    if (!dateRangeResult.success) {
      return validationError(dateRangeResult.error)
    }

    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Get all workspaces
    const workspacesSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.teams)
      .get()

    const workspaces = workspacesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Get mindmaps created in date range
    let mindmapsSnapshot
    try {
      mindmapsSnapshot = await adminDb
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      const allMindmaps = await adminDb.collection(FIRESTORE_COLLECTIONS.sessions).get()
      mindmapsSnapshot = {
        docs: allMindmaps.docs.filter((doc) => {
          const createdAt = doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
          return createdAt >= start && createdAt <= end
        }),
      } as any
    }

    // Get processing jobs for token usage
    let jobsSnapshot
    try {
      jobsSnapshot = await adminDb
        .collection(FIRESTORE_COLLECTIONS.aiJobs)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      const allJobs = await adminDb.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
      jobsSnapshot = {
        docs: allJobs.docs.filter((doc) => {
          const createdAt = doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
          return createdAt >= start && createdAt <= end
        }),
      } as any
    }

    // Get collaboration events
    let collaborationSnapshot
    try {
      collaborationSnapshot = await adminDb
        .collection('analyticsEvents')
        .where('type', '==', 'collaboration')
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<=', endTimestamp)
        .get()
    } catch (error) {
      collaborationSnapshot = { docs: [] } as any
    }

    // Aggregate by workspace
    const workspaceStats: Record<string, {
      workspaceId: string
      workspaceName: string
      plan: string
      memberCount: number
      mindmapCount: number
      tokenUsage: number
      cost: number
      collaborationCount: number
      lastActivityAt: Date | null
    }> = {}

    // Initialize workspace stats
    for (const workspace of workspaces) {
      workspaceStats[workspace.id] = {
        workspaceId: workspace.id,
        workspaceName: workspace.name || 'Unnamed Workspace',
        plan: workspace.plan || 'free',
        memberCount: 0,
        mindmapCount: 0,
        tokenUsage: 0,
        cost: 0,
        collaborationCount: 0,
        lastActivityAt: null,
      }
    }

    // Count mindmaps per workspace
    for (const doc of mindmapsSnapshot.docs) {
      const mindmap = doc.data()
      const workspaceId = mindmap.workspaceId
      if (workspaceId && workspaceStats[workspaceId]) {
        workspaceStats[workspaceId].mindmapCount++
        const createdAt = mindmap.createdAt?.toDate?.() || new Date(mindmap.createdAt)
        if (!workspaceStats[workspaceId].lastActivityAt || createdAt > workspaceStats[workspaceId].lastActivityAt!) {
          workspaceStats[workspaceId].lastActivityAt = createdAt
        }
      }
    }

    // Count tokens and cost per workspace
    for (const doc of jobsSnapshot.docs) {
      const job = doc.data()
      const workspaceId = job.workspaceId
      if (workspaceId && workspaceStats[workspaceId]) {
        workspaceStats[workspaceId].tokenUsage += (job.tokensIn || 0) + (job.tokensOut || 0)
        workspaceStats[workspaceId].cost += job.costUsd || job.cost || 0
        const createdAt = job.createdAt?.toDate?.() || new Date(job.createdAt)
        if (!workspaceStats[workspaceId].lastActivityAt || createdAt > workspaceStats[workspaceId].lastActivityAt!) {
          workspaceStats[workspaceId].lastActivityAt = createdAt
        }
      }
    }

    // Count collaboration events per workspace
    for (const doc of collaborationSnapshot.docs) {
      const event = doc.data()
      const workspaceId = event.workspaceId
      if (workspaceId && workspaceStats[workspaceId]) {
        workspaceStats[workspaceId].collaborationCount++
      }
    }

    // Get member counts
    for (const workspace of workspaces) {
      try {
        const membersSnapshot = await adminDb
          .collection(FIRESTORE_COLLECTIONS.teams)
          .doc(workspace.id)
          .collection('members')
          .get()
        workspaceStats[workspace.id].memberCount = membersSnapshot.size
      } catch (error) {
        // Member count will remain 0
      }
    }

    // Filter to active workspaces (have activity in date range)
    const activeWorkspaces = Object.values(workspaceStats).filter(
      ws => ws.mindmapCount > 0 || ws.tokenUsage > 0 || ws.collaborationCount > 0
    )

    // Calculate activity scores (weighted combination of metrics)
    const topWorkspacesByActivity = activeWorkspaces
      .map(ws => ({
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        activityScore: ws.mindmapCount * 10 + ws.collaborationCount * 5 + (ws.tokenUsage / 1000),
      }))
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10)

    const analytics: WorkspaceActivityAnalytics = {
      activeWorkspaces: activeWorkspaces.length,
      workspaces: activeWorkspaces.map(ws => ({
        ...ws,
        lastActivityAt: ws.lastActivityAt?.toISOString() || null,
      })),
      topWorkspacesByActivity,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('[WorkspaceActivity] Error:', error)
    return errorResponse(error.message || 'Failed to fetch workspace activity analytics', 500)
  }
}

