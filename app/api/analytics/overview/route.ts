import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema, overviewMetricsSchema } from '@/lib/schemas'
import { getPlanMRR } from '@/lib/config'
import { toDate, toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Overview Metrics API
 * 
 * Calculates high-level KPIs for the dashboard:
 * - total_users: Count of all distinct users in Firestore (users collection)
 * - active_users: Users with lastLoginAt within date range
 * - new_registrations: Users created within date range
 * - active_teams: Count of all workspaces (teams)
 * - sessions: Count of mindmaps created within date range
 * - tokens_used: Sum of tokens from processingJobs within date range (tokensIn + tokensOut)
 * - estimated_cost: Sum of costUsd from processingJobs within date range
 * - mrr_estimate: Sum of monthly recurring revenue from all active paying teams
 * 
 * Data sources:
 * - Users: 'users' collection
 * - Teams: 'workspaces' collection
 * - Sessions: 'mindmaps' collection
 * - Tokens/Cost: 'processingJobs' collection (fallback to 'usage' subcollection if available)
 */
export async function POST(request: NextRequest) {
  try {
    // Check if adminDb is initialized
    if (!adminDb) {
      console.error('[Overview] Firebase Admin DB not initialized')
      return NextResponse.json(
        errorResponse('Firebase Admin not configured', 500),
        { status: 500 }
      )
    }

    const body = await request.json()
    
    // Validate date range
    const dateRangeResult = dateRangeSchema.safeParse(body)
    if (!dateRangeResult.success) {
      return NextResponse.json(
        validationError(dateRangeResult.error),
        { status: 400 }
      )
    }
    
    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // KPI 1: Total Users
    // Formula: Count of all documents in 'users' collection
    // Field: All users regardless of status
    const usersSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.users).get()
    const total_users = usersSnapshot.size

    // KPI 2: New Registrations
    // Formula: Count of users where createdAt is within date range
    // Field: users.createdAt
    let new_registrations = 0
    try {
      const newUsersSnapshot = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.users)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
      new_registrations = newUsersSnapshot.size
    } catch (error) {
      // Fallback: Get all and filter client-side if index missing
      console.warn('[Overview] Missing index for users.createdAt query, using fallback')
      new_registrations = usersSnapshot.docs.filter((doc) => {
        const createdAt = toDate(doc.data().createdAt)
        return createdAt && createdAt >= start && createdAt <= end
      }).length
    }

    // KPI 3: Active Users
    // Formula: Count of users where lastLoginAt is within date range
    // Field: users.lastLoginAt
    let active_users = 0
    try {
      const activeUsersSnapshot = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.users)
        .where('lastLoginAt', '>=', startTimestamp)
        .where('lastLoginAt', '<=', endTimestamp)
        .get()
      active_users = activeUsersSnapshot.size
    } catch (error) {
      // Fallback: Get all and filter client-side if index missing
      console.warn('[Overview] Missing index for users.lastLoginAt query, using fallback')
      active_users = usersSnapshot.docs.filter((doc) => {
        const lastLogin = toDate(doc.data().lastLoginAt)
        return lastLogin && lastLogin >= start && lastLogin <= end
      }).length
    }

    // KPI 4: Active Teams
    // Formula: Count of all documents in 'workspaces' collection
    // Field: All workspaces regardless of status
    const workspacesSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.teams).get()
    const active_teams = workspacesSnapshot.size

    // KPI 5: Sessions
    // Formula: Count of mindmaps created within date range
    // Field: mindmaps.createdAt
    let sessions = 0
    try {
      const mindmapsSnapshot = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
      sessions = mindmapsSnapshot.size
    } catch (error) {
      // Fallback: Get all and filter client-side if index missing
      console.warn('[Overview] Missing index for mindmaps.createdAt query, using fallback')
      const allMindmaps = await adminDb!.collection(FIRESTORE_COLLECTIONS.sessions).get()
      sessions = allMindmaps.docs.filter((doc) => {
        const createdAt = toDate(doc.data().createdAt)
        return createdAt && createdAt >= start && createdAt <= end
      }).length
    }

    // KPI 6 & 7: Tokens Used and Estimated Cost
    // Formula: Sum of (tokensIn + tokensOut) and costUsd from processingJobs within date range
    // Fields: processingJobs.tokensIn, processingJobs.tokensOut, processingJobs.costUsd, processingJobs.createdAt
    // Note: We use processingJobs as the source of truth, not sessions, to avoid double-counting
    let tokens_used = 0
    let estimated_cost = 0
    
    try {
      const jobsSnapshot = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.aiJobs)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
      
      for (const doc of jobsSnapshot.docs) {
        const data = doc.data()
        tokens_used += (data.tokensIn || 0) + (data.tokensOut || 0)
        estimated_cost += data.costUsd || data.cost || 0
      }
    } catch (error) {
      // Fallback: Get all and filter client-side if index missing
      console.warn('[Overview] Missing index for processingJobs.createdAt query, using fallback')
      try {
        const allJobs = await adminDb!.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
        for (const doc of allJobs.docs) {
          const data = doc.data()
          const createdAt = toDate(data.createdAt)
          if (createdAt && createdAt >= start && createdAt <= end) {
            tokens_used += (data.tokensIn || 0) + (data.tokensOut || 0)
            estimated_cost += data.costUsd || data.cost || 0
          }
        }
      } catch (jobsError) {
        console.error('[Overview] Could not fetch token usage from processingJobs:', jobsError)
        // Tokens and cost will remain 0
      }
    }

    // KPI 8: MRR Estimate
    // Formula: Sum of PLAN_PRICES[plan] for all workspaces where plan !== 'free'
    // Field: workspaces.plan
    // Uses: lib/config.ts PLAN_PRICES
    let mrr_estimate = 0
    for (const doc of workspacesSnapshot.docs) {
      const plan = (doc.data().plan || 'free') as any
      mrr_estimate += getPlanMRR(plan)
    }

    const result = {
      total_users,
      active_users,
      new_registrations,
      active_teams,
      sessions,
      tokens_used,
      estimated_cost,
      mrr_estimate,
    }

    // Validate response shape
    const validatedResult = overviewMetricsSchema.parse(result)

    return metricResponse(validatedResult, {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Overview] Error fetching overview metrics:', error)
    
    // Return structured error
    if (error.name === 'ZodError') {
      return errorResponse('Data validation failed', 500, error.errors, 'VALIDATION_ERROR')
    }
    
    return errorResponse(error.message || 'Failed to fetch overview metrics', 500, error.message)
  }
}

