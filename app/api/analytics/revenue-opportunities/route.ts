import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { FIRESTORE_COLLECTIONS, PLAN_QUOTAS, PLAN_PRICES } from '@/lib/config'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/revenue-opportunities
 * Identify revenue optimization opportunities
 */

interface RevenueOpportunity {
  userId: string
  type: 'upsell' | 'win_back' | 'expansion'
  currentPlan: string
  recommendedPlan: string
  opportunityValue: number // Additional MRR
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const opportunities: RevenueOpportunity[] = []

    // Get all users
    const usersSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.users)
      .limit(100)
      .get()

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data()
      const userId = userDoc.id
      const currentPlan = userData.plan || 'free'
      const tokenBalance = userData.tokenBalance || 0

      // Check for upsell opportunities (users near quota limits)
      if (currentPlan === 'free' || currentPlan === 'pro') {
        const quota = PLAN_QUOTAS[currentPlan as keyof typeof PLAN_QUOTAS] || 0
        const usagePercent = quota > 0 ? (tokenBalance / quota) * 100 : 0

        if (usagePercent > 80) {
          // User is near quota limit - recommend upgrade
          const recommendedPlan = currentPlan === 'free' ? 'pro' : 'team'
          const currentMRR = PLAN_PRICES[currentPlan as keyof typeof PLAN_PRICES] || 0
          const recommendedMRR = PLAN_PRICES[recommendedPlan as keyof typeof PLAN_PRICES] || 0
          const opportunityValue = recommendedMRR - currentMRR

          opportunities.push({
            userId,
            type: 'upsell',
            currentPlan,
            recommendedPlan,
            opportunityValue,
            reason: `User is using ${usagePercent.toFixed(1)}% of quota - likely to hit limit soon`,
            confidence: usagePercent > 90 ? 'high' : 'medium',
          })
        }
      }

      // Check for win-back opportunities (churned users with recent activity)
      if (userData.lastActivityAt) {
        const lastActivity = userData.lastActivityAt.toDate?.() || new Date(userData.lastActivityAt)
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)

        if (daysSinceActivity < 30 && currentPlan === 'free') {
          // User was active recently but on free plan - could be win-back
          const recommendedPlan = 'pro'
          const opportunityValue = PLAN_PRICES[recommendedPlan] || 0

          opportunities.push({
            userId,
            type: 'win_back',
            currentPlan,
            recommendedPlan,
            opportunityValue,
            reason: `User was active ${Math.round(daysSinceActivity)} days ago - potential win-back candidate`,
            confidence: daysSinceActivity < 7 ? 'high' : 'medium',
          })
        }
      }
    }

    // Sort by opportunity value (highest first)
    opportunities.sort((a, b) => b.opportunityValue - a.opportunityValue)

    return NextResponse.json({
      items: opportunities.slice(0, 50),
      total: opportunities.length,
      totalOpportunityValue: opportunities.reduce((sum, o) => sum + o.opportunityValue, 0),
    })
  } catch (error: any) {
    console.error('[Revenue Opportunities] Error:', error)
    return errorResponse(error.message || 'Failed to identify revenue opportunities', 500)
  }
}

