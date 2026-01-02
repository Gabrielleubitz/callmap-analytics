/**
 * Journey Explorer Utilities
 * 
 * Functions for building chronological event timelines
 * for users and teams
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import type { DateRange } from '@/lib/types'

export type JourneyEventType = 
  | 'upload'
  | 'generate'
  | 'edit'
  | 'export'
  | 'quotaHit'
  | 'upgrade'
  | 'error'
  | 'note'
  | 'collaboration'
  | 'progress_call'
  | 'discussion'

export interface JourneyEvent {
  id: string
  type: JourneyEventType
  timestamp: Date
  description: string
  metadata?: Record<string, any>
}

/**
 * Build journey for a user
 */
export async function buildUserJourney(
  userId: string,
  dateRange: DateRange
): Promise<JourneyEvent[]> {
  if (!adminDb) return []

  const startTimestamp = toFirestoreTimestamp(dateRange.start)
  const endTimestamp = toFirestoreTimestamp(dateRange.end)

  const events: JourneyEvent[] = []

  // Get all analytics events for this user
  const analyticsEvents = await adminDb!
    .collection('analyticsEvents')
    .where('userId', '==', userId)
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
    .orderBy('timestamp', 'asc')
    .get()

  analyticsEvents.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data()
    const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp)

    switch (data.type) {
      case 'mindmap_funnel':
        if (data.step === 'upload') {
          events.push({
            id: doc.id,
            type: 'upload',
            timestamp,
            description: `Uploaded document`,
            metadata: { documentId: data.documentId },
          })
        } else if (data.step === 'generate') {
          events.push({
            id: doc.id,
            type: 'generate',
            timestamp,
            description: `Generated mindmap`,
            metadata: { mindmapId: data.mindmapId },
          })
        } else if (data.step === 'edit') {
          events.push({
            id: doc.id,
            type: 'edit',
            timestamp,
            description: `Edited mindmap`,
            metadata: { mindmapId: data.mindmapId },
          })
        } else if (data.step === 'export') {
          events.push({
            id: doc.id,
            type: 'export',
            timestamp,
            description: `Exported mindmap`,
            metadata: { mindmapId: data.mindmapId, exportType: data.exportType },
          })
        }
        break

      case 'mindmap_generation':
        if (data.success === false) {
          events.push({
            id: doc.id,
            type: 'error',
            timestamp,
            description: `Mindmap generation failed${data.errorMessage ? `: ${data.errorMessage}` : ''}`,
            metadata: { mindmapId: data.mindmapId, documentId: data.documentId },
          })
        } else {
          events.push({
            id: doc.id,
            type: 'generate',
            timestamp,
            description: `Generated mindmap`,
            metadata: { mindmapId: data.mindmapId },
          })
        }
        break

      case 'file_conversion':
        if (!data.success) {
          events.push({
            id: doc.id,
            type: 'error',
            timestamp,
            description: `File conversion failed: ${data.errorMessage || 'Unknown error'}`,
            metadata: { documentId: data.documentId, fileType: data.fileType },
          })
        }
        break

      case 'collaboration':
        events.push({
          id: doc.id,
          type: 'collaboration',
          timestamp,
          description: `${data.activityType?.replace(/_/g, ' ') || 'Collaborated'} on mindmap`,
          metadata: { mindmapId: data.mindmapId, activityType: data.activityType },
        })
        break

      case 'token_burn':
        // Check if this indicates quota hit (high token usage)
        if (data.tokensUsed > 100000) {
          events.push({
            id: doc.id,
            type: 'quotaHit',
            timestamp,
            description: `High token usage: ${data.tokensUsed.toLocaleString()} tokens`,
            metadata: { feature: data.feature, tokensUsed: data.tokensUsed },
          })
        }
        break

      case 'error':
        events.push({
          id: doc.id,
          type: 'error',
          timestamp,
          description: `${data.errorType || 'Error'}: ${data.errorMessage || 'Unknown error'}`,
          metadata: { errorType: data.errorType, ...(data.metadata || {}) },
        })
        break

      case 'subscription':
        events.push({
          id: doc.id,
          type: 'upgrade',
          timestamp,
          description: `Upgraded to ${data.plan || 'pro'} plan${data.amount ? ` ($${data.amount.toFixed(2)} ${data.currency?.toUpperCase() || 'USD'})` : ''}`,
          metadata: { 
            plan: data.plan, 
            subscriptionId: data.subscriptionId,
            amount: data.amount,
            currency: data.currency,
          },
        })
        break

      case 'progress_call':
        events.push({
          id: doc.id,
          type: 'progress_call',
          timestamp,
          description: `Progress call ${data.status || 'created'}: ${data.callId || 'N/A'}`,
          metadata: { 
            callId: data.callId,
            batchId: data.batchId,
            status: data.status,
            questionsAnswered: data.questionsAnswered,
            goalStatus: data.goalStatus,
          },
        })
        break
    }
  })

  // Also fetch progress calls directly from progressCalls collection
  try {
    const progressCallsSnapshot = await adminDb!
      .collection('progressCalls')
      .where('userId', '==', userId)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    progressCallsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const call = doc.data()
      const timestamp = call.createdAt?.toDate?.() || new Date(call.createdAt)
      
      // Check if we already have this event from analyticsEvents
      const exists = events.some(e => e.metadata?.callId === doc.id)
      if (!exists) {
        let description = 'Progress call'
        if (call.status === 'completed') {
          description = `Completed progress call${call.questionsAnswered ? ` (${call.questionsAnswered} questions)` : ''}`
        } else if (call.status === 'in_progress') {
          description = 'Progress call in progress'
        } else if (call.status === 'pending') {
          description = 'Progress call scheduled'
        } else if (call.status === 'declined') {
          description = 'Progress call declined'
        }

        events.push({
          id: doc.id,
          type: 'progress_call',
          timestamp,
          description,
          metadata: {
            callId: doc.id,
            batchId: call.batchId,
            status: call.status,
            questionsAnswered: call.questionsAnswered,
            goalStatus: call.goalStatus,
            completedAt: call.completedAt?.toDate?.() || call.completedAt,
          },
        })
      }
    })
  } catch (error) {
    console.warn('[journeys] Could not fetch progress calls:', error)
  }

  // Fetch discussions from discussions collection
  try {
    const discussionsSnapshot = await adminDb!
      .collection('discussions')
      .where('participatingUserIds', 'array-contains', userId)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    discussionsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const discussion = doc.data()
      const timestamp = discussion.createdAt?.toDate?.() || new Date(discussion.createdAt)
      
      events.push({
        id: doc.id,
        type: 'discussion',
        timestamp,
        description: `Started discussion${discussion.batchId ? ' (from progress call batch)' : ''}`,
        metadata: {
          discussionId: doc.id,
          batchId: discussion.batchId,
          questionId: discussion.questionId,
          status: discussion.status,
        },
      })
    })
  } catch (error) {
    console.warn('[journeys] Could not fetch discussions:', error)
  }

  // Get subscription/upgrade events from subscriptions collection (fallback)
  try {
    const subscriptions = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.subscriptions)
      .where('userId', '==', userId)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    subscriptions.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const sub = doc.data()
      const timestamp = sub.createdAt?.toDate?.() || new Date(sub.createdAt)
      
      // Only add if not already in events (from analyticsEvents)
      const exists = events.some(e => e.id === doc.id)
      if (!exists) {
        events.push({
          id: doc.id,
          type: 'upgrade',
          timestamp,
          description: `Upgraded to ${sub.plan || 'pro'} plan`,
          metadata: { plan: sub.plan },
        })
      }
    })
  } catch (error) {
    // Subscriptions might not exist or have different structure
    console.warn('[journeys] Could not fetch subscriptions:', error)
  }

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return events
}

/**
 * Build journey for a team
 */
export async function buildTeamJourney(
  teamId: string,
  dateRange: DateRange
): Promise<JourneyEvent[]> {
  if (!adminDb) return []

  const startTimestamp = toFirestoreTimestamp(dateRange.start)
  const endTimestamp = toFirestoreTimestamp(dateRange.end)

  const events: JourneyEvent[] = []

  // Get all analytics events for this team
  const analyticsEvents = await adminDb!
    .collection('analyticsEvents')
    .where('workspaceId', '==', teamId)
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
    .orderBy('timestamp', 'asc')
    .get()

  analyticsEvents.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data()
    const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp)

    switch (data.type) {
      case 'mindmap_generation':
        events.push({
          id: doc.id,
          type: 'generate',
          timestamp,
          description: `Team generated mindmap`,
          metadata: { mindmapId: data.mindmapId, userId: data.userId },
        })
        break

      case 'mindmap_edit':
        events.push({
          id: doc.id,
          type: 'edit',
          timestamp,
          description: `Team edited mindmap`,
          metadata: { mindmapId: data.mindmapId, userId: data.userId },
        })
        break

      case 'mindmap_export':
        events.push({
          id: doc.id,
          type: 'export',
          timestamp,
          description: `Team exported mindmap`,
          metadata: { mindmapId: data.mindmapId, userId: data.userId, exportType: data.exportType },
        })
        break

      case 'mindmap_generation':
        if (data.success === false) {
          events.push({
            id: doc.id,
            type: 'error',
            timestamp,
            description: `Team mindmap generation failed${data.errorMessage ? `: ${data.errorMessage}` : ''}`,
            metadata: { mindmapId: data.mindmapId, userId: data.userId },
          })
        } else {
          events.push({
            id: doc.id,
            type: 'generate',
            timestamp,
            description: `Team generated mindmap`,
            metadata: { mindmapId: data.mindmapId, userId: data.userId },
          })
        }
        break

      case 'collaboration':
        events.push({
          id: doc.id,
          type: 'collaboration',
          timestamp,
          description: `Team collaboration: ${data.activityType?.replace(/_/g, ' ') || 'activity'}`,
          metadata: { mindmapId: data.mindmapId, userId: data.userId, activityType: data.activityType },
        })
        break

      case 'error':
        events.push({
          id: doc.id,
          type: 'error',
          timestamp,
          description: `Team error: ${data.errorType || 'Error'}: ${data.errorMessage || 'Unknown error'}`,
          metadata: { errorType: data.errorType, userId: data.userId, ...(data.metadata || {}) },
        })
        break
    }
  })

  // Get subscription/upgrade events for team
  try {
    const subscriptions = await adminDb!
      .collection(FIRESTORE_COLLECTIONS.subscriptions)
      .where('teamId', '==', teamId)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()

    subscriptions.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const sub = doc.data()
      const timestamp = sub.createdAt?.toDate?.() || new Date(sub.createdAt)
      
      events.push({
        id: doc.id,
        type: 'upgrade',
        timestamp,
        description: `Team upgraded to ${sub.plan || 'pro'} plan`,
        metadata: { plan: sub.plan },
      })
    })
  } catch (error) {
    console.warn('[journeys] Could not fetch team subscriptions:', error)
  }

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return events
}

