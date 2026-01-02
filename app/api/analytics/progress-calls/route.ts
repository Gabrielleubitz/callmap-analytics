import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/progress-calls
 * 
 * Progress Calls Analytics
 * Returns metrics for progress calls including completion rates, batches, goal status, etc.
 * 
 * Uses SUPER_ADMIN_ANALYTICS_DATA_MAP.md as reference for Firestore locations
 */

interface ProgressCallsAnalytics {
  totalCalls: number
  completedCalls: number
  pendingCalls: number
  declinedCalls: number
  completionRate: number
  averageQuestionsAnswered: number
  averageDuration: number
  totalBatches: number
  completedBatches: number
  batchCompletionRate: number
  goalStatusDistribution: Record<string, number>
  followUpCallsCreated: number
  dailyCalls: Array<{ date: string; count: number }>
  dailyCompleted: Array<{ date: string; count: number }>
  callsByWorkspace: Record<string, number>
  callsByUser: Record<string, number>
  statusBreakdown: Record<string, number>
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

    // Query progress calls from collection
    const progressCallsSnapshot = await adminDb
      .collection('progressCalls')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    const progressCalls = progressCallsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Also check analyticsEvents for progress call events (if tracked)
    let progressCallEvents: any[] = []
    try {
      const eventsSnapshot = await adminDb
        .collection('analyticsEvents')
        .where('type', '==', 'progress_call')
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<=', endTimestamp)
        .get()
      progressCallEvents = eventsSnapshot.docs.map(doc => doc.data())
    } catch (error) {
      // Analytics events might not have this type yet
      console.warn('[progress-calls] No progress_call events in analyticsEvents:', error)
    }

    // Calculate metrics
    const totalCalls = progressCalls.length
    const completedCalls = progressCalls.filter((call: any) => call.status === 'completed').length
    const pendingCalls = progressCalls.filter((call: any) => 
      call.status === 'pending' || call.status === 'in_progress'
    ).length
    const declinedCalls = progressCalls.filter((call: any) => call.status === 'declined').length
    const completionRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0

    // Average questions answered
    const questionsAnswered = progressCalls
      .filter((call: any) => call.questionsAnswered)
      .map((call: any) => call.questionsAnswered || 0)
    const averageQuestionsAnswered = questionsAnswered.length > 0
      ? questionsAnswered.reduce((sum, val) => sum + val, 0) / questionsAnswered.length
      : 0

    // Average duration (calculate from createdAt to completedAt if duration not available)
    const durations: number[] = []
    progressCalls.forEach((call: any) => {
      if (call.duration) {
        durations.push(call.duration)
      } else if (call.completedAt && call.createdAt) {
        const created = call.createdAt?.toDate?.() || new Date(call.createdAt)
        const completed = call.completedAt?.toDate?.() || new Date(call.completedAt)
        const durationMs = completed.getTime() - created.getTime()
        durations.push(durationMs / 1000) // Convert to seconds
      }
    })
    const averageDuration = durations.length > 0
      ? durations.reduce((sum, val) => sum + val, 0) / durations.length
      : 0

    // Goal status distribution
    const goalStatusDistribution: Record<string, number> = {}
    progressCalls.forEach((call: any) => {
      if (call.goalStatus) {
        goalStatusDistribution[call.goalStatus] = (goalStatusDistribution[call.goalStatus] || 0) + 1
      }
    })

    // Additional metrics: calls by workspace, calls by user, status breakdown
    const callsByWorkspace: Record<string, number> = {}
    const callsByUser: Record<string, number> = {}
    const statusBreakdown: Record<string, number> = {}
    
    progressCalls.forEach((call: any) => {
      // By workspace
      if (call.workspaceId) {
        callsByWorkspace[call.workspaceId] = (callsByWorkspace[call.workspaceId] || 0) + 1
      }
      // By user
      if (call.userId) {
        callsByUser[call.userId] = (callsByUser[call.userId] || 0) + 1
      }
      // Status breakdown
      const status = call.status || 'unknown'
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1
    })

    // Query progress call batches
    const batchesSnapshot = await adminDb
      .collection('progressCallBatches')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    const batches = batchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    const totalBatches = batches.length
    const completedBatches = batches.filter((batch: any) => batch.status === 'completed').length
    const batchCompletionRate = totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0

    // Follow-up calls (calls with a sourceCallId indicating they're follow-ups)
    const followUpCallsCreated = progressCalls.filter((call: any) => call.sourceCallId).length

    // Daily breakdown
    const dailyCallsMap = new Map<string, number>()
    const dailyCompletedMap = new Map<string, number>()

    progressCalls.forEach((call: any) => {
      const createdAt = call.createdAt?.toDate?.() || new Date(call.createdAt)
      const dateKey = createdAt.toISOString().split('T')[0]
      dailyCallsMap.set(dateKey, (dailyCallsMap.get(dateKey) || 0) + 1)
      
      if (call.status === 'completed') {
        dailyCompletedMap.set(dateKey, (dailyCompletedMap.get(dateKey) || 0) + 1)
      }
    })

    const dailyCalls = Array.from(dailyCallsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const dailyCompleted = Array.from(dailyCompletedMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const analytics: ProgressCallsAnalytics = {
      totalCalls,
      completedCalls,
      pendingCalls,
      declinedCalls,
      completionRate,
      averageQuestionsAnswered,
      averageDuration,
      totalBatches,
      completedBatches,
      batchCompletionRate,
      goalStatusDistribution,
      followUpCallsCreated,
      dailyCalls,
      dailyCompleted,
      callsByWorkspace,
      callsByUser,
      statusBreakdown,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('Progress calls analytics error:', error)
    return errorResponse(error.message || 'Failed to fetch progress calls analytics', 500)
  }
}

