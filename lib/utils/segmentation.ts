/**
 * Segmentation Utilities
 * 
 * Functions for segmenting analytics data by:
 * - Plan (free, pro, team, enterprise)
 * - Workspace size (solo, 2-5, 6-20, 20+)
 * - Source type (file, audio, url, text)
 * - Account age bucket (0-7d, 8-30d, 31-90d, 90+d)
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'

export type Plan = 'free' | 'pro' | 'team' | 'enterprise'
export type WorkspaceSize = 'solo' | '2-5' | '6-20' | '20+'
export type SourceType = 'file' | 'audio' | 'url' | 'text'
export type AccountAgeBucket = '0-7d' | '8-30d' | '31-90d' | '90+d'

export interface SegmentationFilters {
  plan?: Plan[]
  workspaceSize?: WorkspaceSize[]
  sourceType?: SourceType[]
  accountAgeBucket?: AccountAgeBucket[]
}

/**
 * Get workspace size category from member count
 */
export function getWorkspaceSize(memberCount: number): WorkspaceSize {
  if (memberCount === 1) return 'solo'
  if (memberCount >= 2 && memberCount <= 5) return '2-5'
  if (memberCount >= 6 && memberCount <= 20) return '6-20'
  return '20+'
}

/**
 * Get account age bucket from signup date
 */
export function getAccountAgeBucket(signupDate: Date): AccountAgeBucket {
  const now = new Date()
  const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceSignup <= 7) return '0-7d'
  if (daysSinceSignup <= 30) return '8-30d'
  if (daysSinceSignup <= 90) return '31-90d'
  return '90+d'
}

/**
 * Get team plan
 */
export async function getTeamPlan(teamId: string): Promise<Plan> {
  if (!adminDb) return 'free'

  try {
    const teamDoc = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.teams)
      .doc(teamId)
      .get()

    if (!teamDoc.exists) return 'free'

    const team = teamDoc.data()
    const plan = team?.plan || 'free'
    
    return (plan === 'free' || plan === 'pro' || plan === 'team' || plan === 'enterprise')
      ? plan
      : 'free'
  } catch (error) {
    console.error('[segmentation] Error getting team plan:', error)
    return 'free'
  }
}

/**
 * Get workspace size for a team
 */
export async function getTeamWorkspaceSize(teamId: string): Promise<WorkspaceSize> {
  if (!adminDb) return 'solo'

  try {
    // Count members in workspace
    const membersSnapshot = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.teams)
      .doc(teamId)
      .collection('members')
      .get()

    const memberCount = membersSnapshot.size || 1
    return getWorkspaceSize(memberCount)
  } catch (error) {
    // If members collection doesn't exist, try alternative structure
    try {
      const teamDoc = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.teams)
        .doc(teamId)
        .get()

      if (teamDoc.exists) {
        const team = teamDoc.data()
        const memberCount = team?.memberCount || team?.members?.length || 1
        return getWorkspaceSize(memberCount)
      }
    } catch (err) {
      console.error('[segmentation] Error getting workspace size:', err)
    }
    return 'solo'
  }
}

/**
 * Get user account age bucket
 */
export async function getUserAccountAgeBucket(userId: string): Promise<AccountAgeBucket> {
  if (!adminDb) return '90+d'

  try {
    const userDoc = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.users)
      .doc(userId)
      .get()

    if (!userDoc.exists) return '90+d'

    const user = userDoc.data()
    const createdAt = user?.createdAt

    if (!createdAt) return '90+d'

    let signupDate: Date
    if (createdAt.toDate) {
      signupDate = createdAt.toDate()
    } else if (createdAt instanceof Date) {
      signupDate = createdAt
    } else if (typeof createdAt === 'string') {
      signupDate = new Date(createdAt)
    } else {
      return '90+d'
    }

    return getAccountAgeBucket(signupDate)
  } catch (error) {
    console.error('[segmentation] Error getting account age:', error)
    return '90+d'
  }
}

/**
 * Check if a team matches segmentation filters
 */
export async function teamMatchesFilters(
  teamId: string,
  filters: SegmentationFilters
): Promise<boolean> {
  if (Object.keys(filters).length === 0) return true

  const [plan, workspaceSize] = await Promise.all([
    getTeamPlan(teamId),
    getTeamWorkspaceSize(teamId),
  ])

  if (filters.plan && filters.plan.length > 0 && !filters.plan.includes(plan)) {
    return false
  }

  if (filters.workspaceSize && filters.workspaceSize.length > 0 && !filters.workspaceSize.includes(workspaceSize)) {
    return false
  }

  return true
}

/**
 * Check if a user matches segmentation filters
 */
export async function userMatchesFilters(
  userId: string,
  teamId: string | null,
  filters: SegmentationFilters
): Promise<boolean> {
  if (Object.keys(filters).length === 0) return true

  // Check team-level filters
  if (teamId) {
    const teamMatches = await teamMatchesFilters(teamId, filters)
    if (!teamMatches) return false
  }

  // Check account age bucket
  if (filters.accountAgeBucket && filters.accountAgeBucket.length > 0) {
    const ageBucket = await getUserAccountAgeBucket(userId)
    if (!filters.accountAgeBucket.includes(ageBucket)) {
      return false
    }
  }

  return true
}

