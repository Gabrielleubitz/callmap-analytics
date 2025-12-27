import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Mindmap Content Analytics API
 * 
 * Provides analytics about mindmap content:
 * - Average nodes per mindmap
 * - Total nodes across all mindmaps
 * - Tag distribution
 * - Most active mindmaps (by view/edit count)
 * - Mindmap distribution by source type
 */

interface MindmapContentAnalytics {
  averageNodesPerMindmap: number
  totalNodes: number
  totalMindmaps: number
  tagDistribution: Array<{ tag: string; count: number }>
  mostActiveMindmaps: Array<{
    mindmapId: string
    title: string
    viewCount: number
    editCount: number
    exportCount: number
    createdAt: string
  }>
  distributionBySourceType: Array<{ sourceType: string; count: number }>
  distributionByWorkspace: Array<{ workspaceId: string | null; count: number }>
}

function countNodes(outlineJson: any): number {
  if (!outlineJson || typeof outlineJson !== 'object') {
    return 0
  }
  
  // If it's an array, count all items and their children
  if (Array.isArray(outlineJson)) {
    return outlineJson.reduce((count, item) => {
      return count + 1 + (item.children ? countNodes(item.children) : 0)
    }, 0)
  }
  
  // If it's an object with children
  if (outlineJson.children && Array.isArray(outlineJson.children)) {
    return 1 + countNodes(outlineJson.children)
  }
  
  // Single node
  return 1
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

    // Query mindmaps created in date range
    let mindmapsSnapshot
    try {
      mindmapsSnapshot = await adminDb
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // Fallback: Get all and filter client-side
      console.warn('[MindmapContent] Missing index for createdAt query, using fallback')
      const allMindmaps = await adminDb.collection(FIRESTORE_COLLECTIONS.sessions).get()
      mindmapsSnapshot = {
        docs: allMindmaps.docs.filter((doc) => {
          const createdAt = doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
          return createdAt >= start && createdAt <= end
        }),
        empty: false,
      } as any
    }

    const mindmaps = mindmapsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Calculate node counts
    let totalNodes = 0
    const nodeCounts: number[] = []
    
    for (const mindmap of mindmaps as any[]) {
      const nodeCount = countNodes(mindmap.outlineJson)
      totalNodes += nodeCount
      nodeCounts.push(nodeCount)
    }

    const averageNodesPerMindmap = mindmaps.length > 0 
      ? totalNodes / mindmaps.length 
      : 0

    // Tag distribution
    const tagCounts: Record<string, number> = {}
    for (const mindmap of mindmaps as any[]) {
      const tags = mindmap.tags || []
      if (Array.isArray(tags)) {
        tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      }
    }
    const tagDistribution = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)

    // Most active mindmaps (by view/edit/export count)
    // Note: We'll use editCount and exportCount from mindmap data
    // View count would need to be tracked separately
    const mostActiveMindmaps = (mindmaps as any[])
      .map((mindmap: any) => ({
        mindmapId: mindmap.id,
        title: mindmap.title || 'Untitled',
        viewCount: mindmap.viewCount || 0,
        editCount: mindmap.editCount || 0,
        exportCount: (mindmap.exportCount_pdf || 0) + (mindmap.exportCount_png || 0),
        createdAt: mindmap.createdAt?.toDate?.()?.toISOString() || mindmap.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => {
        const aScore = a.viewCount + a.editCount + a.exportCount
        const bScore = b.viewCount + b.editCount + b.exportCount
        return bScore - aScore
      })
      .slice(0, 20)

    // Distribution by source type
    const sourceTypeCounts: Record<string, number> = {}
    for (const mindmap of mindmaps as any[]) {
      const sourceType = mindmap.sourceType || 'unknown'
      sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] || 0) + 1
    }
    const distributionBySourceType = Object.entries(sourceTypeCounts)
      .map(([sourceType, count]) => ({ sourceType, count }))
      .sort((a, b) => b.count - a.count)

    // Distribution by workspace
    const workspaceCounts: Record<string, number> = {}
    for (const mindmap of mindmaps as any[]) {
      const workspaceId = mindmap.workspaceId || 'personal'
      workspaceCounts[workspaceId] = (workspaceCounts[workspaceId] || 0) + 1
    }
    const distributionByWorkspace = Object.entries(workspaceCounts)
      .map(([workspaceId, count]) => ({ 
        workspaceId: workspaceId === 'personal' ? null : workspaceId, 
        count 
      }))
      .sort((a, b) => b.count - a.count)

    const analytics: MindmapContentAnalytics = {
      averageNodesPerMindmap: Math.round(averageNodesPerMindmap * 100) / 100,
      totalNodes,
      totalMindmaps: mindmaps.length,
      tagDistribution,
      mostActiveMindmaps,
      distributionBySourceType,
      distributionByWorkspace,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('[MindmapContent] Error:', error)
    return errorResponse(error.message || 'Failed to fetch mindmap content analytics', 500)
  }
}

