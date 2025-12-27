/**
 * User Health Scoring System
 * 
 * Calculates a composite health score (0-100) for each user based on:
 * - Activity level
 * - Engagement metrics
 * - Feature usage
 * - Sentiment (if available)
 * - Payment status
 * - Error frequency
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

export interface UserHealthScore {
  userId: string
  score: number // 0-100
  factors: {
    activity: number // 0-25 points
    engagement: number // 0-25 points
    featureUsage: number // 0-25 points
    sentiment: number // 0-15 points (if available)
    payment: number // 0-10 points
  }
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  lastCalculated: Date
  trends: {
    scoreChange: number // Change from last week
    trend: 'improving' | 'stable' | 'declining'
  }
  recommendations: string[]
}

/**
 * Calculate health score for a single user
 */
export async function calculateUserHealthScore(userId: string): Promise<UserHealthScore> {
  if (!adminDb) {
    throw new Error('Database not initialized')
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Get user data
  const userDoc = await adminDb.collection(FIRESTORE_COLLECTIONS.users).doc(userId).get()
  if (!userDoc.exists) {
    throw new Error('User not found')
  }
  const userData = userDoc.data()

  // Get user activity (last 7 days)
  const weeklyActivitySnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.users)
    .doc(userId)
    .collection('weeklyActivity')
    .get()
    .catch(() => ({ docs: [] } as any))

  let totalActivity = 0
  for (const doc of weeklyActivitySnapshot.docs) {
    const data = doc.data()
        totalActivity += (data.login || 0) + (data.mindmap_view || 0) + (data.mindmap_create || 0) + (data.mindmap_edit || 0) + (data.export || 0)
  }

  // Get mindmaps created (last 30 days)
  const mindmapsSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.sessions)
    .where('userId', '==', userId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get()
    .catch(() => ({ size: 0 } as any))

  const mindmapsCreated = mindmapsSnapshot.size

  // Get feature usage (last 30 days)
  const eventsSnapshot = await adminDb
    .collection('analyticsEvents')
    .where('userId', '==', userId)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get()
    .catch(() => ({ docs: [] } as any))

  const featureUsage = {
    exports: eventsSnapshot.docs.filter((d: any) => d.data().type === 'mindmap_export').length,
    collaborations: eventsSnapshot.docs.filter((d: any) => d.data().type === 'collaboration').length,
    edits: eventsSnapshot.docs.filter((d: any) => d.data().type === 'mindmap_edit').length,
  }

  // Get errors (last 30 days)
  const errorsSnapshot = await adminDb
    .collection(FIRESTORE_COLLECTIONS.supportErrors)
    .where('user_id', '==', userId)
    .where('created_at', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get()
    .catch(() => ({ docs: [] } as any))

  const errorCount = errorsSnapshot.docs.length

  // Calculate factors
  // Activity (0-25 points): Based on weekly activity
  const activityScore = Math.min(25, (totalActivity / 10) * 5) // 10 activities = 5 points, max 25

  // Engagement (0-25 points): Based on mindmaps created and edits
  const engagementScore = Math.min(25, (mindmapsCreated / 5) * 5 + (featureUsage.edits / 10) * 5)

  // Feature Usage (0-25 points): Based on using multiple features
  const featureScore = Math.min(25, 
    (featureUsage.exports > 0 ? 8 : 0) +
    (featureUsage.collaborations > 0 ? 8 : 0) +
    (featureUsage.edits > 5 ? 9 : featureUsage.edits * 1.8)
  )

  // Sentiment (0-15 points): Based on average sentiment of mindmaps (if available)
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
      // Map sentiment (-1 to 1) to score (0 to 15)
      sentimentScore = ((avgSentiment + 1) / 2) * 15
    }
  }

  // Payment (0-10 points): Based on plan
  const plan = userData?.plan || 'free'
  const paymentScore = plan === 'free' ? 0 : plan === 'pro' ? 5 : plan === 'team' ? 8 : 10

  // Calculate total score
  const totalScore = activityScore + engagementScore + featureScore + sentimentScore + paymentScore

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  if (totalScore < 30) {
    riskLevel = 'critical'
  } else if (totalScore < 50) {
    riskLevel = 'high'
  } else if (totalScore < 70) {
    riskLevel = 'medium'
  }

  // Generate recommendations
  const recommendations: string[] = []
  if (activityScore < 10) {
    recommendations.push('User has low activity - consider re-engagement campaign')
  }
  if (engagementScore < 10) {
    recommendations.push('User is not creating mindmaps - may need onboarding support')
  }
  if (featureScore < 10) {
    recommendations.push('User is not using key features - suggest feature discovery')
  }
  if (errorCount > 5) {
    recommendations.push(`User has ${errorCount} errors - may need support`)
  }
  if (plan === 'free' && totalScore > 60) {
    recommendations.push('High-value free user - consider upgrade campaign')
  }

  // Get previous score for trend (simplified - would need to store historical scores)
  const scoreChange = 0 // Would calculate from stored history
  const trend: 'improving' | 'stable' | 'declining' = scoreChange > 5 ? 'improving' : scoreChange < -5 ? 'declining' : 'stable'

  return {
    userId,
    score: Math.round(totalScore),
    factors: {
      activity: Math.round(activityScore),
      engagement: Math.round(engagementScore),
      featureUsage: Math.round(featureScore),
      sentiment: Math.round(sentimentScore),
      payment: Math.round(paymentScore),
    },
    riskLevel,
    lastCalculated: now,
    trends: {
      scoreChange,
      trend,
    },
    recommendations,
  }
}

/**
 * Get health scores for multiple users
 */
export async function getUsersHealthScores(userIds: string[]): Promise<UserHealthScore[]> {
  const scores: UserHealthScore[] = []
  
  for (const userId of userIds) {
    try {
      const score = await calculateUserHealthScore(userId)
      scores.push(score)
    } catch (error) {
      console.error(`[User Health] Error calculating score for ${userId}:`, error)
    }
  }

  return scores.sort((a, b) => a.score - b.score) // Sort by score (lowest first = at risk)
}

/**
 * Get at-risk users (score < 50)
 */
export async function getAtRiskUsers(limit: number = 50): Promise<UserHealthScore[]> {
  if (!adminDb) {
    return []
  }

  try {
    // Get all users
    const usersSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.users)
      .limit(limit * 2) // Get more to account for filtering
      .get()

    const userIds = usersSnapshot.docs.map(doc => doc.id)
    const allScores = await getUsersHealthScores(userIds)
    
    // Filter to at-risk users and sort
    return allScores
      .filter(score => score.score < 50)
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
  } catch (error) {
    console.error('[User Health] Error getting at-risk users:', error)
    return []
  }
}

