/**
 * Economics Utilities
 * 
 * Functions for calculating team and user economics:
 * - Token costs
 * - MRR
 * - AI margins
 * - Cost per mindmap
 * - Maps per active user
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { calculateTokenCost, getPlanMRR, PLAN_PRICES } from '@/lib/config/pricing'
import type { DateRange } from '@/lib/types'

export interface TeamEconomics {
  teamId: string
  teamName: string
  plan: string
  mrr: number
  totalTokenCost: number
  aiMargin: number
  mindmapsCount: number
  activeUsers: number
  costPerMindmap: number
  mapsPerActiveUser: number
}

/**
 * Calculate token cost for a single AI job
 * Uses pricing config to determine cost based on model and token usage
 */
export function getTokenCostForJob(job: {
  model?: string
  tokensIn?: number
  tokensOut?: number
  promptTokens?: number
  completionTokens?: number
}): number {
  const model = job.model || 'gpt-4o-mini'
  const tokensIn = job.tokensIn ?? job.promptTokens ?? 0
  const tokensOut = job.tokensOut ?? job.completionTokens ?? 0
  
  return calculateTokenCost(tokensIn, tokensOut, model)
}

/**
 * Get total token cost for a team in a date range
 * Queries AI jobs (processingJobs) and token burn events
 */
export async function getTeamTokenCost(
  teamId: string,
  dateRange: DateRange
): Promise<number> {
  if (!adminDb) return 0

  const startTimestamp = toFirestoreTimestamp(dateRange.start)
  const endTimestamp = toFirestoreTimestamp(dateRange.end)

  let totalCost = 0

  // Query token burn events (from analytics tracking)
  // Note: workspaceId can be null for personal accounts, so we need to handle that
  const tokenBurnEventsQuery = adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'token_burn')
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
  
  const tokenBurnEvents = await tokenBurnEventsQuery.get()
  
  // Filter by workspaceId in memory (since Firestore doesn't support null comparisons well)
  const filteredEvents = tokenBurnEvents.docs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data()
    return data.workspaceId === teamId
  })

  filteredEvents.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data()
    const tokensUsed = data.tokensUsed || 0
    const feature = data.feature || 'mindmap_generation'
    const metadata = data.metadata || {}
    const model = metadata.model || 'gpt-4o-mini'
    
    // Estimate token split (60% input, 40% output is typical)
    const tokensIn = Math.round(tokensUsed * 0.6)
    const tokensOut = Math.round(tokensUsed * 0.4)
    
    totalCost += calculateTokenCost(tokensIn, tokensOut, model)
  })

  // Also query processingJobs if they exist
  try {
    const jobs = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('teamId', '==', teamId)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    jobs.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const job = doc.data()
      totalCost += getTokenCostForJob({
        model: job.model,
        tokensIn: job.tokensIn,
        tokensOut: job.tokensOut,
        promptTokens: job.promptTokens,
        completionTokens: job.completionTokens,
      })
    })
  } catch (error) {
    // If collection doesn't exist or query fails, continue with token burn events only
    console.warn('[economics] Could not query processingJobs:', error)
  }

  return Math.round(totalCost * 100) / 100 // Round to 2 decimal places
}

/**
 * Get MRR for a team
 * Checks subscription first, then falls back to plan-based pricing
 */
export async function getTeamMRR(
  teamId: string,
  teamPlan?: string
): Promise<number> {
  if (!adminDb) return 0

  // Try to get MRR from subscription
  try {
    const subscriptions = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.subscriptions)
      .where('teamId', '==', teamId)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (!subscriptions.empty) {
      const sub = subscriptions.docs[0].data()
      if (sub.mrr && typeof sub.mrr === 'number') {
        return sub.mrr
      }
    }
  } catch (error) {
    console.warn('[economics] Could not query subscriptions:', error)
  }

  // Fall back to plan-based pricing
  if (teamPlan && teamPlan in PLAN_PRICES) {
    return getPlanMRR(teamPlan as keyof typeof PLAN_PRICES)
  }

  return 0
}

/**
 * Get mindmap count for a team in date range
 */
export async function getTeamMindmapCount(
  teamId: string,
  dateRange: DateRange
): Promise<number> {
  if (!adminDb) return 0

  const startTimestamp = toFirestoreTimestamp(dateRange.start)
  const endTimestamp = toFirestoreTimestamp(dateRange.end)

  // Query mindmaps - workspaceId can be null, so we filter in memory
  const mindmapsQuery = adminDb!
    .collection(FIRESTORE_COLLECTIONS.sessions)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
  
  const mindmaps = await mindmapsQuery.get()
  
  // Filter by workspaceId
  const filteredMindmaps = mindmaps.docs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    return doc.data().workspaceId === teamId
  })

  return filteredMindmaps.length
}

/**
 * Get active users for a team in date range
 * Active = users who generated, edited, or exported mindmaps
 */
export async function getTeamActiveUsers(
  teamId: string,
  dateRange: DateRange
): Promise<number> {
  if (!adminDb) return 0

  const startTimestamp = toFirestoreTimestamp(dateRange.start)
  const endTimestamp = toFirestoreTimestamp(dateRange.end)

  const activeUserIds = new Set<string>()

  // Get users from mindmap generation events
  // Filter by workspaceId in memory since Firestore queries with null don't work well
  const generationEventsQuery = adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'mindmap_generation')
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
  
  const generationEvents = await generationEventsQuery.get()
  generationEvents.docs
    .filter((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data().workspaceId === teamId)
    .forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const userId = doc.data().userId
      if (userId) activeUserIds.add(userId)
    })

  // Get users from edit events
  const editEventsQuery = adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'mindmap_edit')
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
  
  const editEvents = await editEventsQuery.get()
  editEvents.docs
    .filter((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data().workspaceId === teamId)
    .forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const userId = doc.data().userId
      if (userId) activeUserIds.add(userId)
    })

  // Get users from export events
  const exportEventsQuery = adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'mindmap_export')
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
  
  const exportEvents = await exportEventsQuery.get()
  exportEvents.docs
    .filter((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data().workspaceId === teamId)
    .forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const userId = doc.data().userId
      if (userId) activeUserIds.add(userId)
    })

  return activeUserIds.size
}

/**
 * Get complete economics for a team
 */
export async function getTeamEconomics(
  teamId: string,
  teamName: string,
  teamPlan: string,
  dateRange: DateRange
): Promise<TeamEconomics> {
  const [mrr, totalTokenCost, mindmapsCount, activeUsers] = await Promise.all([
    getTeamMRR(teamId, teamPlan),
    getTeamTokenCost(teamId, dateRange),
    getTeamMindmapCount(teamId, dateRange),
    getTeamActiveUsers(teamId, dateRange),
  ])

  const aiMargin = mrr - totalTokenCost
  const costPerMindmap = mindmapsCount > 0 ? totalTokenCost / mindmapsCount : 0
  const mapsPerActiveUser = activeUsers > 0 ? mindmapsCount / activeUsers : 0

  return {
    teamId,
    teamName,
    plan: teamPlan,
    mrr: Math.round(mrr * 100) / 100,
    totalTokenCost: Math.round(totalTokenCost * 100) / 100,
    aiMargin: Math.round(aiMargin * 100) / 100,
    mindmapsCount,
    activeUsers,
    costPerMindmap: Math.round(costPerMindmap * 100) / 100,
    mapsPerActiveUser: Math.round(mapsPerActiveUser * 100) / 100,
  }
}

