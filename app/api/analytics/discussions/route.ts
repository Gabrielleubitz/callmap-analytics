import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/discussions
 * 
 * Discussions Analytics
 * Returns metrics for discussions including active/closed, participation, messages, etc.
 * 
 * Uses SUPER_ADMIN_ANALYTICS_DATA_MAP.md as reference for Firestore locations
 */

interface DiscussionsAnalytics {
  totalDiscussions: number
  activeDiscussions: number
  closedDiscussions: number
  expiredDiscussions: number
  totalMessages: number
  averageMessagesPerDiscussion: number
  averageParticipants: number
  participationRate: number
  closureRate: number
  averageTimeToClose: number
  dailyDiscussions: Array<{ date: string; count: number }>
  dailyMessages: Array<{ date: string; count: number }>
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
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Query discussions
    const discussionsSnapshot = await adminDb
      .collection('discussions')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    const discussions = discussionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Calculate metrics
    const totalDiscussions = discussions.length
    const activeDiscussions = discussions.filter((disc: any) => disc.status === 'active').length
    const closedDiscussions = discussions.filter((disc: any) => disc.status === 'closed').length
    const expiredDiscussions = discussions.filter((disc: any) => disc.status === 'expired').length

    // Get all discussion messages
    let totalMessages = 0
    const discussionMessageCounts: Record<string, number> = {}
    const participantCounts: number[] = []
    const closureTimes: number[] = []

    for (const discussion of discussions) {
      try {
        const messagesSnapshot = await adminDb
          .collection('discussionMessages')
          .where('discussionId', '==', discussion.id)
          .get()

        const messageCount = messagesSnapshot.docs.length
        totalMessages += messageCount
        discussionMessageCounts[discussion.id] = messageCount

        // Count participants
        const participants = (discussion as any).participatingUserIds || []
        participantCounts.push(participants.length)

        // Calculate time to close (if closed)
        if ((discussion as any).status === 'closed' && (discussion as any).closedAt && (discussion as any).createdAt) {
          const createdAt = (discussion as any).createdAt.toDate?.() || new Date((discussion as any).createdAt)
          const closedAt = (discussion as any).closedAt.toDate?.() || new Date((discussion as any).closedAt)
          const timeToClose = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60) // hours
          closureTimes.push(timeToClose)
        }
      } catch (error) {
        // Skip if messages collection doesn't exist for this discussion
      }
    }

    const averageMessagesPerDiscussion = totalDiscussions > 0 ? totalMessages / totalDiscussions : 0
    const averageParticipants = participantCounts.length > 0
      ? participantCounts.reduce((sum, val) => sum + val, 0) / participantCounts.length
      : 0

    // Participation rate (discussions with at least one message)
    const discussionsWithMessages = Object.keys(discussionMessageCounts).filter(
      id => discussionMessageCounts[id] > 0
    ).length
    const participationRate = totalDiscussions > 0 ? (discussionsWithMessages / totalDiscussions) * 100 : 0

    // Closure rate
    const closureRate = totalDiscussions > 0 ? (closedDiscussions / totalDiscussions) * 100 : 0

    // Average time to close
    const averageTimeToClose = closureTimes.length > 0
      ? closureTimes.reduce((sum, val) => sum + val, 0) / closureTimes.length
      : 0

    // Daily breakdown
    const dailyDiscussionsMap = new Map<string, number>()
    const dailyMessagesMap = new Map<string, number>()

    discussions.forEach((discussion: any) => {
      const createdAt = discussion.createdAt?.toDate?.() || new Date(discussion.createdAt)
      const dateKey = createdAt.toISOString().split('T')[0]
      dailyDiscussionsMap.set(dateKey, (dailyDiscussionsMap.get(dateKey) || 0) + 1)
    })

    // Get daily message counts
    try {
      const allMessagesSnapshot = await adminDb
        .collection('discussionMessages')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()

      allMessagesSnapshot.docs.forEach((doc: any) => {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt)
        const dateKey = createdAt.toISOString().split('T')[0]
        dailyMessagesMap.set(dateKey, (dailyMessagesMap.get(dateKey) || 0) + 1)
      })
    } catch (error) {
      // Continue if query fails
    }

    const dailyDiscussions = Array.from(dailyDiscussionsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const dailyMessages = Array.from(dailyMessagesMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const analytics: DiscussionsAnalytics = {
      totalDiscussions,
      activeDiscussions,
      closedDiscussions,
      expiredDiscussions,
      totalMessages,
      averageMessagesPerDiscussion,
      averageParticipants,
      participationRate,
      closureRate,
      averageTimeToClose,
      dailyDiscussions,
      dailyMessages,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('Discussions analytics error:', error)
    return errorResponse(error.message || 'Failed to fetch discussions analytics', 500)
  }
}

