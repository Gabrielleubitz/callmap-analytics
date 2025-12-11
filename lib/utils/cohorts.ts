/**
 * Behavior Cohorts Utilities
 * 
 * Functions for assigning users to behavior-based cohorts
 * and calculating retention curves
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import type { DateRange } from '@/lib/types'

export type CohortKey = 'EXPORTERS_WEEK1' | 'EDITORS_3PLUS_WEEK1' | 'ONE_AND_DONE' | 'COLLABORATORS_WEEK1'

export interface CohortCurve {
  cohortKey: CohortKey
  size: number
  weeks: {
    weekNumber: number
    activeUsers: number
    retentionRate: number // 0-1
  }[]
}

/**
 * Get user's signup date
 */
async function getUserSignupDate(userId: string): Promise<Date | null> {
  if (!adminDb) return null

  try {
    const userDoc = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.users)
      .doc(userId)
      .get()

    if (!userDoc.exists) return null

    const userData = userDoc.data()
    const createdAt = userData?.createdAt

    if (!createdAt) return null

    // Handle Firestore Timestamp
    if (createdAt.toDate) {
      return createdAt.toDate()
    }

    if (createdAt instanceof Date) {
      return createdAt
    }

    if (typeof createdAt === 'string') {
      return new Date(createdAt)
    }

    return null
  } catch (error) {
    console.error('[cohorts] Error getting user signup date:', error)
    return null
  }
}

/**
 * Check if user exported in first 7 days
 */
async function didUserExportInWeek1(userId: string, signupDate: Date): Promise<boolean> {
  if (!adminDb) return false

  const week1End = new Date(signupDate)
  week1End.setDate(week1End.getDate() + 7)

  const exportEvents = await adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'mindmap_export')
    .where('userId', '==', userId)
    .where('timestamp', '>=', toFirestoreTimestamp(signupDate))
    .where('timestamp', '<=', toFirestoreTimestamp(week1End))
    .limit(1)
    .get()

  return !exportEvents.empty
}

/**
 * Count edit events in first 7 days
 */
async function getEditCountInWeek1(userId: string, signupDate: Date): Promise<number> {
  if (!adminDb) return 0

  const week1End = new Date(signupDate)
  week1End.setDate(week1End.getDate() + 7)

  const editEvents = await adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'mindmap_edit')
    .where('userId', '==', userId)
    .where('timestamp', '>=', toFirestoreTimestamp(signupDate))
    .where('timestamp', '<=', toFirestoreTimestamp(week1End))
    .get()

  return editEvents.size
}

/**
 * Get mindmap count in first 7 days
 */
async function getMindmapCountInWeek1(userId: string, signupDate: Date): Promise<number> {
  if (!adminDb) return 0

  const week1End = new Date(signupDate)
  week1End.setDate(week1End.getDate() + 7)

  const mindmaps = await adminDb!
    .collection(FIRESTORE_COLLECTIONS.sessions)
    .where('userId', '==', userId)
    .where('createdAt', '>=', toFirestoreTimestamp(signupDate))
    .where('createdAt', '<=', toFirestoreTimestamp(week1End))
    .get()

  return mindmaps.size
}

/**
 * Check if user collaborated in first 7 days
 */
async function didUserCollaborateInWeek1(userId: string, signupDate: Date): Promise<boolean> {
  if (!adminDb) return false

  const week1End = new Date(signupDate)
  week1End.setDate(week1End.getDate() + 7)

  const collaborationEvents = await adminDb!
    .collection('analyticsEvents')
    .where('type', '==', 'collaboration')
    .where('userId', '==', userId)
    .where('timestamp', '>=', toFirestoreTimestamp(signupDate))
    .where('timestamp', '<=', toFirestoreTimestamp(week1End))
    .limit(1)
    .get()

  return !collaborationEvents.empty
}

/**
 * Assign user to cohorts based on week-1 behavior
 */
export async function assignUserToCohorts(userId: string): Promise<CohortKey[]> {
  const signupDate = await getUserSignupDate(userId)
  if (!signupDate) return []

  const cohorts: CohortKey[] = []

  // Check all week-1 behaviors in parallel
  const [exported, editCount, mindmapCount, collaborated] = await Promise.all([
    didUserExportInWeek1(userId, signupDate),
    getEditCountInWeek1(userId, signupDate),
    getMindmapCountInWeek1(userId, signupDate),
    didUserCollaborateInWeek1(userId, signupDate),
  ])

  // EXPORTERS_WEEK1
  if (exported) {
    cohorts.push('EXPORTERS_WEEK1')
  }

  // EDITORS_3PLUS_WEEK1
  if (editCount >= 3) {
    cohorts.push('EDITORS_3PLUS_WEEK1')
  }

  // ONE_AND_DONE
  if (mindmapCount === 1 && editCount === 0 && !exported) {
    cohorts.push('ONE_AND_DONE')
  }

  // COLLABORATORS_WEEK1
  if (collaborated) {
    cohorts.push('COLLABORATORS_WEEK1')
  }

  return cohorts
}

/**
 * Get active users in a specific week for a cohort
 * Optimized: Query all events for all users in parallel, then filter by week
 */
async function getActiveUsersInWeek(
  userIds: string[],
  signupDates: Map<string, Date>,
  weekNumber: number
): Promise<Set<string>> {
  if (!adminDb || userIds.length === 0) return new Set()

  const activeUsers = new Set<string>()

  // Calculate week ranges for all users
  const weekRanges = new Map<string, { start: Date; end: Date }>()
  for (const userId of userIds) {
    const signupDate = signupDates.get(userId)
    if (!signupDate) continue

    const weekStart = new Date(signupDate)
    weekStart.setDate(weekStart.getDate() + 7 * weekNumber)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    weekRanges.set(userId, { start: weekStart, end: weekEnd })
  }

  if (weekRanges.size === 0) return activeUsers

  // Get all activity events for these users in parallel
  // We'll query by activity type and filter by userId and week range
  const activityTypes = [
    'mindmap_generation',
    'mindmap_edit',
    'mindmap_export',
    'collaboration',
  ]

  // For each user, check if they have activity in their week range
  // This is still N queries but we can batch by activity type
  const userActivityChecks = Array.from(weekRanges.entries()).map(async ([userId, range]) => {
    for (const activityType of activityTypes) {
      try {
        const events = await adminDb!
          .collection('analyticsEvents')
          .where('type', '==', activityType)
          .where('userId', '==', userId)
          .where('timestamp', '>=', toFirestoreTimestamp(range.start))
          .where('timestamp', '<', toFirestoreTimestamp(range.end))
          .limit(1)
          .get()

        if (!events.empty) {
          return userId
        }
      } catch (error) {
        // Continue to next activity type
        continue
      }
    }
    return null
  })

  const results = await Promise.all(userActivityChecks)
  results.forEach(userId => {
    if (userId) activeUsers.add(userId)
  })

  return activeUsers
}

/**
 * Calculate retention curve for a cohort
 */
export async function calculateCohortRetention(
  cohortKey: CohortKey,
  userIds: string[],
  maxWeeks: number = 12
): Promise<CohortCurve> {
  if (userIds.length === 0) {
    return {
      cohortKey,
      size: 0,
      weeks: [],
    }
  }

  // Get signup dates for all users
  const signupDates = new Map<string, Date>()
  for (const userId of userIds) {
    const signupDate = await getUserSignupDate(userId)
    if (signupDate) {
      signupDates.set(userId, signupDate)
    }
  }

  const weeks: CohortCurve['weeks'] = []

  // Calculate retention for each week
  for (let weekNumber = 1; weekNumber <= maxWeeks; weekNumber++) {
    const activeUsers = await getActiveUsersInWeek(
      Array.from(signupDates.keys()),
      signupDates,
      weekNumber
    )

    const retentionRate = signupDates.size > 0
      ? activeUsers.size / signupDates.size
      : 0

    weeks.push({
      weekNumber,
      activeUsers: activeUsers.size,
      retentionRate: Math.round(retentionRate * 10000) / 10000, // Round to 4 decimals
    })
  }

  return {
    cohortKey,
    size: signupDates.size,
    weeks,
  }
}

/**
 * Build cohorts for users who signed up in a date range
 */
export async function buildCohortsForSignupWindow(
  dateRange: DateRange
): Promise<Map<CohortKey, string[]>> {
  if (!adminDb) return new Map()

  const startTimestamp = toFirestoreTimestamp(dateRange.start)
  const endTimestamp = toFirestoreTimestamp(dateRange.end)

  // Get all users who signed up in this window
  const usersSnapshot = await adminDb!
    .collection(FIRESTORE_COLLECTIONS.users)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
    .get()

  const cohortMap = new Map<CohortKey, string[]>()

  // Initialize cohorts
  cohortMap.set('EXPORTERS_WEEK1', [])
  cohortMap.set('EDITORS_3PLUS_WEEK1', [])
  cohortMap.set('ONE_AND_DONE', [])
  cohortMap.set('COLLABORATORS_WEEK1', [])

  // Assign each user to cohorts
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id
    const cohorts = await assignUserToCohorts(userId)

    for (const cohort of cohorts) {
      const existing = cohortMap.get(cohort) || []
      cohortMap.set(cohort, [...existing, userId])
    }
  }

  return cohortMap
}

