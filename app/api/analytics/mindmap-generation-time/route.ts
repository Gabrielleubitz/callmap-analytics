import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toDate, toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { getTeamPlan, getTeamWorkspaceSize, getUserAccountAgeBucket } from '@/lib/utils/segmentation'
import type { SegmentationFilters } from '@/lib/utils/segmentation'

/**
 * Mindmap Generation Time Metrics
 * 
 * Returns average and distribution of mindmap generation times
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Database not initialized'), { status: 500 })
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse(body)

    if (!dateRangeResult.success) {
      return NextResponse.json(validationError(dateRangeResult.error), { status: 400 })
    }

    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Parse segmentation filters
    const filters: SegmentationFilters = {
      plan: body.plan ? (Array.isArray(body.plan) ? body.plan : [body.plan]) : undefined,
      workspaceSize: body.workspaceSize ? (Array.isArray(body.workspaceSize) ? body.workspaceSize : [body.workspaceSize]) : undefined,
      sourceType: body.sourceType ? (Array.isArray(body.sourceType) ? body.sourceType : [body.sourceType]) : undefined,
      accountAgeBucket: body.accountAgeBucket ? (Array.isArray(body.accountAgeBucket) ? body.accountAgeBucket : [body.accountAgeBucket]) : undefined,
    }

    // Query mindmaps created in date range with generation time data
    const mindmapsSnapshot = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.sessions)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    const generationTimes: number[] = []
    const bySourceType: Record<string, number[]> = {}
    const byPlan: Record<string, number[]> = {}
    const byWorkspaceSize: Record<string, number[]> = {}
    const byAccountAge: Record<string, number[]> = {}

    // Process mindmaps with segmentation
    for (const doc of mindmapsSnapshot.docs) {
      const data = doc.data()
      const generationTimeMs = data.generationTimeMs
      
      if (!generationTimeMs || typeof generationTimeMs !== 'number') continue

      const workspaceId = data.workspaceId
      const userId = data.userId
      const sourceType = data.sourceType || 'unknown'

      // Apply source type filter
      if (filters.sourceType && filters.sourceType.length > 0 && !filters.sourceType.includes(sourceType as any)) {
        continue
      }

      // Get segmentation dimensions
      let plan: string = 'free'
      let workspaceSize: string = 'solo'
      let accountAge: string = '90+d'

      if (workspaceId) {
        plan = await getTeamPlan(workspaceId)
        workspaceSize = await getTeamWorkspaceSize(workspaceId)
      }

      if (userId) {
        accountAge = await getUserAccountAgeBucket(userId)
      }

      // Apply filters
      if (filters.plan && filters.plan.length > 0 && !filters.plan.includes(plan as any)) {
        continue
      }

      if (filters.workspaceSize && filters.workspaceSize.length > 0 && !filters.workspaceSize.includes(workspaceSize as any)) {
        continue
      }

      if (filters.accountAgeBucket && filters.accountAgeBucket.length > 0 && !filters.accountAgeBucket.includes(accountAge as any)) {
        continue
      }

      // Add to aggregations
      generationTimes.push(generationTimeMs)
      
      if (!bySourceType[sourceType]) {
        bySourceType[sourceType] = []
      }
      bySourceType[sourceType].push(generationTimeMs)

      if (!byPlan[plan]) {
        byPlan[plan] = []
      }
      byPlan[plan].push(generationTimeMs)

      if (!byWorkspaceSize[workspaceSize]) {
        byWorkspaceSize[workspaceSize] = []
      }
      byWorkspaceSize[workspaceSize].push(generationTimeMs)

      if (!byAccountAge[accountAge]) {
        byAccountAge[accountAge] = []
      }
      byAccountAge[accountAge].push(generationTimeMs)
    }

    // Calculate statistics
    const avgGenerationTime = generationTimes.length > 0
      ? generationTimes.reduce((sum, time) => sum + time, 0) / generationTimes.length
      : 0

    const sortedTimes = [...generationTimes].sort((a, b) => a - b)
    const medianGenerationTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0

    const p95GenerationTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
      : 0

    // Calculate averages by dimension
    const avgBySourceType: Record<string, number> = {}
    Object.keys(bySourceType).forEach(sourceType => {
      const times = bySourceType[sourceType]
      avgBySourceType[sourceType] = times.reduce((sum, time) => sum + time, 0) / times.length
    })

    const avgByPlan: Record<string, number> = {}
    Object.keys(byPlan).forEach(plan => {
      const times = byPlan[plan]
      avgByPlan[plan] = times.reduce((sum, time) => sum + time, 0) / times.length
    })

    const avgByWorkspaceSize: Record<string, number> = {}
    Object.keys(byWorkspaceSize).forEach(size => {
      const times = byWorkspaceSize[size]
      avgByWorkspaceSize[size] = times.reduce((sum, time) => sum + time, 0) / times.length
    })

    const avgByAccountAge: Record<string, number> = {}
    Object.keys(byAccountAge).forEach(age => {
      const times = byAccountAge[age]
      avgByAccountAge[age] = times.reduce((sum, time) => sum + time, 0) / times.length
    })

    return metricResponse({
      totalMindmaps: generationTimes.length,
      avgGenerationTimeMs: Math.round(avgGenerationTime),
      medianGenerationTimeMs: Math.round(medianGenerationTime),
      p95GenerationTimeMs: Math.round(p95GenerationTime),
      minGenerationTimeMs: sortedTimes.length > 0 ? Math.round(sortedTimes[0]) : 0,
      maxGenerationTimeMs: sortedTimes.length > 0 ? Math.round(sortedTimes[sortedTimes.length - 1]) : 0,
      avgBySourceType,
      avgByPlan,
      avgByWorkspaceSize,
      avgByAccountAge,
    })
  } catch (error: any) {
    console.error('[analytics/mindmap-generation-time] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

