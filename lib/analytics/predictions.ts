/**
 * Predictive Analytics & Forecasting Engine
 * 
 * Implements forecasting algorithms for:
 * - Churn prediction (ML-based risk scoring)
 * - Revenue forecasting (MRR, ARR trends)
 * - Usage forecasting (token usage, mindmap creation, user growth)
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

export interface ChurnPrediction {
  userId: string
  churnRisk: number // 0-100
  predictedChurnDate: Date | null
  factors: {
    activityDrop: number // 0-30 points
    paymentIssues: number // 0-25 points
    featureUsage: number // 0-20 points
    sentimentTrend: number // 0-15 points
    errorFrequency: number // 0-10 points
  }
  interventionRecommendations: string[]
}

export interface RevenueForecast {
  period: '30d' | '60d' | '90d'
  forecastedMRR: number
  forecastedARR: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  trend: 'increasing' | 'stable' | 'decreasing'
  factors: {
    newCustomers: number
    churnRate: number
    expansionRate: number
  }
}

export interface UsageForecast {
  metric: 'tokens' | 'mindmaps' | 'users'
  period: '30d' | '60d' | '90d'
  forecastedValue: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  trend: 'increasing' | 'stable' | 'decreasing'
  growthRate: number // percentage
}

/**
 * Simple linear regression for forecasting
 */
function linearRegression(data: Array<{ x: number; y: number }>): { slope: number; intercept: number } {
  const n = data.length
  if (n === 0) return { slope: 0, intercept: 0 }

  const sumX = data.reduce((sum, d) => sum + d.x, 0)
  const sumY = data.reduce((sum, d) => sum + d.y, 0)
  const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0)
  const sumXX = data.reduce((sum, d) => sum + d.x * d.x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

/**
 * Calculate exponential smoothing
 */
function exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
  if (data.length === 0) return []
  
  const smoothed: number[] = [data[0]]
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1])
  }
  return smoothed
}

/**
 * Predict churn risk for a user
 */
export async function predictChurn(userId: string): Promise<ChurnPrediction> {
  if (!adminDb) {
    throw new Error('Database not initialized')
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Get user data
  const userDoc = await adminDb.collection(FIRESTORE_COLLECTIONS.users).doc(userId).get()
  if (!userDoc.exists) {
    throw new Error('User not found')
  }
  const userData = userDoc.data()

  // Get activity in last 30 days vs previous 30 days
  const recentActivitySnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.users)
    .doc(userId)
    .collection('weeklyActivity')
    .get()
    .catch(() => ({ docs: [] } as any))

  let recentActivity = 0
  let previousActivity = 0
  for (const doc of recentActivitySnapshot.docs) {
    const data = doc.data()
    const weekDate = data.weekStart?.toDate?.() || new Date(doc.id)
    const activity = (data.login || 0) + (data.mindmap_view || 0) + (data.mindmap_create || 0)
    
    if (weekDate >= thirtyDaysAgo) {
      recentActivity += activity
    } else if (weekDate >= sixtyDaysAgo) {
      previousActivity += activity
    }
  }

  // Calculate activity drop
  const activityDrop = previousActivity > 0
    ? Math.min(30, ((previousActivity - recentActivity) / previousActivity) * 30)
    : recentActivity === 0 ? 30 : 0

  // Check payment issues (simplified - would check subscription status)
  const plan = userData?.plan || 'free'
  const paymentIssues = plan === 'free' ? 0 : 5 // Would check for past_due, canceled, etc.

  // Feature usage (last 30 days)
  const eventsSnapshot = await adminDb
    .collection('analyticsEvents')
    .where('userId', '==', userId)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get()
    .catch(() => ({ docs: [] } as any))

  const featureUsage = eventsSnapshot.docs.length
  const featureUsageScore = Math.min(20, 20 - (featureUsage / 10)) // Lower usage = higher risk

  // Sentiment trend (if available)
  const mindmapsSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.sessions)
    .where('userId', '==', userId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get()
    .catch(() => ({ docs: [] } as any))

  let sentimentScore = 7.5 // Default neutral
  if (mindmapsSnapshot.size > 0) {
    let totalSentiment = 0
    let count = 0
    for (const doc of mindmapsSnapshot.docs) {
      const data = doc.data()
      if (data.sentimentScore !== undefined && data.sentimentScore !== null) {
        totalSentiment += data.sentimentScore
        count++
      }
    }
    if (count > 0) {
      const avgSentiment = totalSentiment / count
      // Negative sentiment = higher risk
      sentimentScore = ((1 - avgSentiment) / 2) * 15
    }
  }

  // Error frequency
  const errorsSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.supportErrors)
    .where('user_id', '==', userId)
    .where('created_at', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get()
    .catch(() => ({ docs: [] } as any))

  const errorFrequency = Math.min(10, errorsSnapshot.docs.length * 2)

  // Calculate total churn risk
  const churnRisk = Math.min(100, activityDrop + paymentIssues + featureUsageScore + sentimentScore + errorFrequency)

  // Predict churn date (simplified heuristic)
  let predictedChurnDate: Date | null = null
  if (churnRisk > 70) {
    const daysUntilChurn = 100 - churnRisk // Higher risk = sooner churn
    predictedChurnDate = new Date(now.getTime() + daysUntilChurn * 24 * 60 * 60 * 1000)
  }

  // Generate recommendations
  const recommendations: string[] = []
  if (activityDrop > 15) {
    recommendations.push('User activity has dropped significantly - send re-engagement email')
  }
  if (featureUsageScore > 10) {
    recommendations.push('User is not using key features - provide onboarding support')
  }
  if (errorFrequency > 5) {
    recommendations.push('User experiencing frequent errors - reach out with support')
  }
  if (churnRisk > 80) {
    recommendations.push('High churn risk - consider offering discount or upgrade incentive')
  }

  return {
    userId,
    churnRisk: Math.round(churnRisk),
    predictedChurnDate,
    factors: {
      activityDrop: Math.round(activityDrop),
      paymentIssues: Math.round(paymentIssues),
      featureUsage: Math.round(featureUsageScore),
      sentimentTrend: Math.round(sentimentScore),
      errorFrequency: Math.round(errorFrequency),
    },
    interventionRecommendations: recommendations,
  }
}

/**
 * Forecast revenue (MRR/ARR)
 */
export async function forecastRevenue(period: '30d' | '60d' | '90d'): Promise<RevenueForecast> {
  if (!adminDb) {
    throw new Error('Database not initialized')
  }

  const now = new Date()
  const days = period === '30d' ? 30 : period === '60d' ? 60 : 90
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // Last 90 days for training

  // Get historical MRR data (last 90 days, grouped by week)
  const subscriptionsSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.subscriptions)
    .where('status', '==', 'active')
    .get()
    .catch(() => ({ docs: [] } as any))

  // Simplified: Calculate current MRR
  let currentMRR = 0
  for (const doc of subscriptionsSnapshot.docs) {
    const data = doc.data()
    const plan = data.plan || 'free'
    if (plan === 'pro') currentMRR += 29
    else if (plan === 'team') currentMRR += 99
    else if (plan === 'enterprise') currentMRR += 299
  }

  // Get churn rate (users who canceled in last 30 days)
  const canceledSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.subscriptions)
    .where('status', '==', 'canceled')
    .where('canceledAt', '>=', admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
    .get()
    .catch(() => ({ docs: [] } as any))

  const churnRate = subscriptionsSnapshot.docs.length > 0
    ? canceledSnapshot.docs.length / subscriptionsSnapshot.docs.length
    : 0

  // Get new customers (last 30 days)
  const newCustomersSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.users)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
    .get()
    .catch(() => ({ size: 0 } as any))

  const newCustomers = newCustomersSnapshot.size

  // Simple linear forecast
  const growthRate = 0.05 // 5% monthly growth (simplified)
  const forecastedMRR = currentMRR * Math.pow(1 + growthRate, days / 30)
  const forecastedARR = forecastedMRR * 12

  // Confidence interval (simplified: ±10%)
  const confidenceInterval = {
    lower: forecastedMRR * 0.9,
    upper: forecastedMRR * 1.1,
  }

  const trend: 'increasing' | 'stable' | 'decreasing' = growthRate > 0.02 ? 'increasing' : growthRate < -0.02 ? 'decreasing' : 'stable'

  return {
    period,
    forecastedMRR: Math.round(forecastedMRR),
    forecastedARR: Math.round(forecastedARR),
    confidenceInterval: {
      lower: Math.round(confidenceInterval.lower),
      upper: Math.round(confidenceInterval.upper),
    },
    trend,
    factors: {
      newCustomers,
      churnRate: churnRate * 100, // percentage
      expansionRate: 0, // Would calculate from upgrades
    },
  }
}

/**
 * Forecast usage metrics
 */
export async function forecastUsage(
  metric: 'tokens' | 'mindmaps' | 'users',
  period: '30d' | '60d' | '90d'
): Promise<UsageForecast> {
  if (!adminDb) {
    throw new Error('Database not initialized')
  }

  const now = new Date()
  const days = period === '30d' ? 30 : period === '60d' ? 60 : 90
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  let historicalData: number[] = []

  // Get historical data (last 90 days, grouped by week)
  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    let value = 0
    switch (metric) {
      case 'tokens': {
        const jobsSnapshot = await adminDb
          .collection(FIRESTORE_COLLECTIONS.aiJobs)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekStart))
          .where('createdAt', '<', admin.firestore.Timestamp.fromDate(weekEnd))
          .get()
          .catch(() => ({ docs: [] } as any))

        for (const doc of jobsSnapshot.docs) {
          const data = doc.data()
          value += (data.tokensIn || 0) + (data.tokensOut || 0)
        }
        break
      }
      case 'mindmaps': {
        const mindmapsSnapshot = await adminDb
          .collection(FIRESTORE_COLLECTIONS.sessions)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekStart))
          .where('createdAt', '<', admin.firestore.Timestamp.fromDate(weekEnd))
          .get()
          .catch(() => ({ size: 0 } as any))

        value = mindmapsSnapshot.size
        break
      }
      case 'users': {
        const usersSnapshot = await adminDb
          .collection(FIRESTORE_COLLECTIONS.users)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekStart))
          .where('createdAt', '<', admin.firestore.Timestamp.fromDate(weekEnd))
          .get()
          .catch(() => ({ size: 0 } as any))

        value = usersSnapshot.size
        break
      }
    }
    historicalData.push(value)
  }

  // Apply exponential smoothing
  const smoothed = exponentialSmoothing(historicalData, 0.3)
  const recentTrend = smoothed.slice(-4) // Last 4 weeks

  // Calculate growth rate
  const avgRecent = recentTrend.reduce((sum, v) => sum + v, 0) / recentTrend.length
  const avgEarlier = smoothed.slice(0, 4).reduce((sum, v) => sum + v, 0) / 4
  const growthRate = avgEarlier > 0 ? ((avgRecent - avgEarlier) / avgEarlier) * 100 : 0

  // Forecast using linear regression
  const regressionData = recentTrend.map((y, i) => ({ x: i, y }))
  const { slope, intercept } = linearRegression(regressionData)

  const forecastedValue = slope * (recentTrend.length + days / 7) + intercept
  const confidenceInterval = {
    lower: forecastedValue * 0.85,
    upper: forecastedValue * 1.15,
  }

  const trend: 'increasing' | 'stable' | 'decreasing' = growthRate > 5 ? 'increasing' : growthRate < -5 ? 'decreasing' : 'stable'

  return {
    metric,
    period,
    forecastedValue: Math.round(forecastedValue),
    confidenceInterval: {
      lower: Math.round(confidenceInterval.lower),
      upper: Math.round(confidenceInterval.upper),
    },
    trend,
    growthRate: Math.round(growthRate * 100) / 100,
  }
}

