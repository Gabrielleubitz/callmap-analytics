import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * User Retention by Week
 * 
 * Returns weekly retention metrics
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

    // Get all users
    const usersSnapshot = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.users)
      .get()

    // Get weekly activity for all users
    const weeklyActivity: Record<string, Set<string>> = {} // weekKey -> Set of userIds

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id
      const weeklyActivitySnapshot = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.users)
        .doc(userId)
        .collection('weeklyActivity')
        .get()

      weeklyActivitySnapshot.docs.forEach((weekDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const weekKey = weekDoc.id
        if (!weeklyActivity[weekKey]) {
          weeklyActivity[weekKey] = new Set()
        }
        weeklyActivity[weekKey].add(userId)
      })
    }

    // Calculate retention by week
    const weeks = Object.keys(weeklyActivity).sort()
    const retentionData = weeks.map((weekKey, index) => {
      const activeUsers = weeklyActivity[weekKey].size
      const previousWeek = index > 0 ? weeklyActivity[weeks[index - 1]] : null
      const retainedUsers = previousWeek
        ? Array.from(weeklyActivity[weekKey]).filter(userId => previousWeek.has(userId)).length
        : 0
      const retentionRate = previousWeek && previousWeek.size > 0
        ? (retainedUsers / previousWeek.size) * 100
        : 0

      return {
        week: weekKey,
        activeUsers,
        retainedUsers,
        newUsers: activeUsers - retainedUsers,
        retentionRate: Math.round(retentionRate * 100) / 100,
      }
    })

    // Calculate overall retention
    const totalUsers = usersSnapshot.size
    const activeUsersThisPeriod = new Set(
      weeks.flatMap(weekKey => Array.from(weeklyActivity[weekKey]))
    ).size

    return metricResponse({
      totalUsers,
      activeUsersThisPeriod,
      weeklyRetention: retentionData,
    })
  } catch (error: any) {
    console.error('[analytics/user-retention] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

