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
    }
  })

  // Get subscription/upgrade events
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
      
      events.push({
        id: doc.id,
        type: 'upgrade',
        timestamp,
        description: `Upgraded to ${sub.plan || 'pro'} plan`,
        metadata: { plan: sub.plan },
      })
    })
  } catch (error) {
    // Subscriptions might not exist or have different structure
    console.warn('[journeys] Could not fetch subscriptions:', error)
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

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

      case 'collaboration':
        events.push({
          id: doc.id,
          type: 'collaboration',
          timestamp,
          description: `Team collaboration: ${data.activityType?.replace(/_/g, ' ') || 'activity'}`,
          metadata: { mindmapId: data.mindmapId, userId: data.userId, activityType: data.activityType },
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

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  return events
}

