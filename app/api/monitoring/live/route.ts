import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * Real-Time Monitoring API
 * 
 * Returns current system metrics for live monitoring dashboard
 * - Active users (last 5 minutes)
 * - Active sessions
 * - Token burn rate (tokens per minute)
 * - Error rate (errors per minute)
 * - System health indicators
 */

interface LiveMetrics {
  timestamp: string
  activeUsers: number
  activeSessions: number
  tokenBurnRate: number // tokens per minute
  errorRate: number // errors per minute
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical'
    indicators: {
      apiLatency: number
      errorRate: number
      jobFailureRate: number
    }
  }
  recentActivity: Array<{
    type: string
    userId?: string
    workspaceId?: string
    timestamp: string
    details: Record<string, any>
  }>
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

    // Get active users (users with activity in last 5 minutes)
    const activeUsersSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.users)
      .where('lastActivityAt', '>=', admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
      .get()
      .catch(() => ({ size: 0, docs: [] } as any))

    const activeUsers = activeUsersSnapshot.size

    // Get active sessions (mindmaps created in last 5 minutes)
    const activeSessionsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.sessions)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
      .get()
      .catch(() => ({ size: 0, docs: [] } as any))

    const activeSessions = activeSessionsSnapshot.size

    // Calculate token burn rate (tokens used in last minute)
    const recentJobsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
      .get()
      .catch(() => ({ docs: [] } as any))

    let tokenBurnRate = 0
    for (const doc of recentJobsSnapshot.docs) {
      const data = doc.data()
      tokenBurnRate += (data.tokensIn || 0) + (data.tokensOut || 0)
    }

    // Calculate error rate (errors in last minute)
    const recentErrorsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrors)
      .where('created_at', '>=', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
      .get()
      .catch(() => ({ docs: [] } as any))

    const errorRate = recentErrorsSnapshot.docs.length

    // Get recent activity feed (last 20 events)
    let recentEventsSnapshot
    try {
      recentEventsSnapshot = await adminDb
        .collection('analyticsEvents')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get()
    } catch (indexError: any) {
      // If index doesn't exist, fetch all and sort in memory
      console.warn('[Monitoring Live] Missing Firestore index, using fallback:', indexError.message)
      const allEvents = await adminDb
        .collection('analyticsEvents')
        .limit(100)
        .get()
      
      // Sort by timestamp in memory
      const sorted = allEvents.docs.sort((a, b) => {
        const aTime = a.data().timestamp?.toMillis?.() || 0
        const bTime = b.data().timestamp?.toMillis?.() || 0
        return bTime - aTime
      })
      
      recentEventsSnapshot = {
        docs: sorted.slice(0, 20),
      } as any
    }

    const recentActivity = recentEventsSnapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        type: data.type || 'unknown',
        userId: data.userId || null,
        workspaceId: data.workspaceId || null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
        details: {
          ...data,
          timestamp: undefined, // Already extracted
        },
      }
    })

    // Calculate system health
    const failedJobsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('status', '==', 'failed')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
      .get()
      .catch(() => ({ docs: [] } as any))

    const totalJobsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
      .get()
      .catch(() => ({ docs: [] } as any))

    const jobFailureRate = totalJobsSnapshot.docs.length > 0
      ? failedJobsSnapshot.docs.length / totalJobsSnapshot.docs.length
      : 0

    // Determine system health status
    let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (errorRate > 10 || jobFailureRate > 0.1) {
      healthStatus = 'critical'
    } else if (errorRate > 5 || jobFailureRate > 0.05) {
      healthStatus = 'degraded'
    }

    const metrics: LiveMetrics = {
      timestamp: now.toISOString(),
      activeUsers,
      activeSessions,
      tokenBurnRate,
      errorRate,
      systemHealth: {
        status: healthStatus,
        indicators: {
          apiLatency: 0, // Would need to track this separately
          errorRate,
          jobFailureRate,
        },
      },
      recentActivity,
    }

    return NextResponse.json({ data: metrics })
  } catch (error: any) {
    console.error('[Monitoring Live] Error:', error)
    return errorResponse(error.message || 'Failed to fetch live metrics', 500)
  }
}

