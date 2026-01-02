import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'

/**
 * GET /api/analytics/user-lifecycle
 * 
 * User Lifecycle Analytics
 * Returns metrics for user signups, activation, churn, onboarding, etc.
 * 
 * Uses SUPER_ADMIN_ANALYTICS_DATA_MAP.md as reference for Firestore locations
 */

interface UserLifecycleAnalytics {
  totalUsers: number
  newSignups: number
  activatedUsers: number
  activationRate: number
  dau: number
  wau: number
  mau: number
  churn30d: number
  churn60d: number
  churn90d: number
  planDistribution: Record<string, number>
  onboardedUsers: number
  onboardingCompletionRate: number
  accountAgeDistribution: {
    '0-7 days': number
    '8-30 days': number
    '31-90 days': number
    '91-180 days': number
    '180+ days': number
  }
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
    
    // Calculate date ranges for churn and active users
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    
    const oneDayAgoTimestamp = toFirestoreTimestamp(oneDayAgo)
    const oneWeekAgoTimestamp = toFirestoreTimestamp(oneWeekAgo)
    const oneMonthAgoTimestamp = toFirestoreTimestamp(oneMonthAgo)
    const thirtyDaysAgoTimestamp = toFirestoreTimestamp(thirtyDaysAgo)
    const sixtyDaysAgoTimestamp = toFirestoreTimestamp(sixtyDaysAgo)
    const ninetyDaysAgoTimestamp = toFirestoreTimestamp(ninetyDaysAgo)

    // Get all users
    const usersSnapshot = await adminDb.collection(FIRESTORE_COLLECTIONS.users).get()
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    // New signups in date range
    const newSignups = allUsers.filter((user: any) => {
      const createdAt = user.createdAt?.toDate?.() || new Date(user.createdAt)
      return createdAt >= start && createdAt <= end
    }).length
    
    // Activated users (onboarded = true)
    const activatedUsers = allUsers.filter((user: any) => user.onboarded === true).length
    const activationRate = allUsers.length > 0 ? (activatedUsers / allUsers.length) * 100 : 0
    
    // Active users (DAU, WAU, MAU)
    const dau = allUsers.filter((user: any) => {
      const lastActivity = user.lastActivityAt?.toDate?.() || user.lastLoginAt?.toDate?.() || new Date(user.createdAt)
      return lastActivity >= oneDayAgo
    }).length
    
    const wau = allUsers.filter((user: any) => {
      const lastActivity = user.lastActivityAt?.toDate?.() || user.lastLoginAt?.toDate?.() || new Date(user.createdAt)
      return lastActivity >= oneWeekAgo
    }).length
    
    const mau = allUsers.filter((user: any) => {
      const lastActivity = user.lastActivityAt?.toDate?.() || user.lastLoginAt?.toDate?.() || new Date(user.createdAt)
      return lastActivity >= oneMonthAgo
    }).length
    
    // Churn (users with no activity for 30/60/90 days)
    const churn30d = allUsers.filter((user: any) => {
      const lastActivity = user.lastActivityAt?.toDate?.() || user.lastLoginAt?.toDate?.() || new Date(user.createdAt)
      return lastActivity < thirtyDaysAgo
    }).length
    
    const churn60d = allUsers.filter((user: any) => {
      const lastActivity = user.lastActivityAt?.toDate?.() || user.lastLoginAt?.toDate?.() || new Date(user.createdAt)
      return lastActivity < sixtyDaysAgo
    }).length
    
    const churn90d = allUsers.filter((user: any) => {
      const lastActivity = user.lastActivityAt?.toDate?.() || user.lastLoginAt?.toDate?.() || new Date(user.createdAt)
      return lastActivity < ninetyDaysAgo
    }).length
    
    // Plan distribution
    const planDistribution: Record<string, number> = {}
    allUsers.forEach((user: any) => {
      const plan = user.plan || 'free'
      planDistribution[plan] = (planDistribution[plan] || 0) + 1
    })
    
    // Onboarding completion
    const onboardedUsers = allUsers.filter((user: any) => user.onboarded === true).length
    const onboardingCompletionRate = allUsers.length > 0 ? (onboardedUsers / allUsers.length) * 100 : 0

    // Account age distribution
    const accountAgeDistribution = {
      '0-7 days': 0,
      '8-30 days': 0,
      '31-90 days': 0,
      '91-180 days': 0,
      '180+ days': 0,
    }

    allUsers.forEach((user: any) => {
      const createdAt = user.createdAt?.toDate?.() || new Date(user.createdAt)
      const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      
      if (ageInDays <= 7) {
        accountAgeDistribution['0-7 days']++
      } else if (ageInDays <= 30) {
        accountAgeDistribution['8-30 days']++
      } else if (ageInDays <= 90) {
        accountAgeDistribution['31-90 days']++
      } else if (ageInDays <= 180) {
        accountAgeDistribution['91-180 days']++
      } else {
        accountAgeDistribution['180+ days']++
      }
    })

    const analytics: UserLifecycleAnalytics = {
      totalUsers: allUsers.length,
      newSignups,
      activatedUsers,
      activationRate,
      dau,
      wau,
      mau,
      churn30d,
      churn60d,
      churn90d,
      planDistribution,
      onboardedUsers,
      onboardingCompletionRate,
      accountAgeDistribution,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('User lifecycle analytics error:', error)
    return errorResponse(error.message || 'Failed to fetch user lifecycle analytics', 500)
  }
}

