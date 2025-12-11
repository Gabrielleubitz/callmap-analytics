import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getPlanQuota, FIRESTORE_COLLECTIONS } from '@/lib/config'
import { Plan } from '@/lib/types'
import { getTeamCurrentMonthUsage } from '@/lib/utils/tokens'
import { calculateQuotaPercentage } from '@/lib/utils/metrics'

/**
 * Teams Over Quota API
 * 
 * Returns teams that are using 80% or more of their monthly token quota.
 * 
 * Formula:
 * - quota = PLAN_QUOTAS[team.plan] from lib/config.ts
 * - used = Sum of tokens from processingJobs for current month where workspaceId matches
 * - percentage = (used / quota) * 100
 * 
 * Fields:
 * - workspaces.plan (for quota lookup)
 * - processingJobs.workspaceId, processingJobs.tokensIn, processingJobs.tokensOut, processingJobs.createdAt
 * 
 * Uses:
 * - getPlanQuota() from lib/config.ts
 * - getTeamCurrentMonthUsage() from lib/utils/tokens.ts
 * - calculateQuotaPercentage() from lib/utils/metrics.ts
 */
export async function POST(request: NextRequest) {
  try {
    // Get all workspaces
    const workspacesSnapshot = await adminDb.collection(FIRESTORE_COLLECTIONS.teams).get()
    const result: Array<{ team_id: string; team_name: string; quota: number; used: number; percentage: number }> = []

    for (const workspaceDoc of workspacesSnapshot.docs) {
      const workspaceData = workspaceDoc.data()
      const plan = (workspaceData.plan || 'free') as Plan
      
      // Get quota from config (ensures consistency)
      const quota = getPlanQuota(plan)
      
      // Get current month usage using shared utility
      // Formula: Sum tokens from processingJobs for this team in current month
      let used = 0
      try {
        used = await getTeamCurrentMonthUsage(workspaceDoc.id)
      } catch (error) {
        console.warn(`[Teams Over Quota] Could not fetch usage for team ${workspaceDoc.id}:`, error)
        // Continue with used = 0
      }

      // Calculate percentage using shared utility
      const percentage = calculateQuotaPercentage(used, quota)

      // Only include teams at 80% or more of quota
      if (percentage >= 80) {
        result.push({
          team_id: workspaceDoc.id,
          team_name: workspaceData.name || workspaceDoc.id,
          quota,
          used,
          percentage,
        })
      }
    }

    // Sort by percentage descending
    result.sort((a, b) => b.percentage - a.percentage)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Teams Over Quota] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams over quota' },
      { status: 500 }
    )
  }
}

