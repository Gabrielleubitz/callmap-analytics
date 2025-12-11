import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { toDate } from '@/lib/utils/date'

/**
 * Diagnostics API
 * 
 * Provides sanity checks and data integrity information:
 * - Document counts for key collections
 * - Oldest/newest timestamps for time-series data
 * - Data integrity checks (orphaned records, missing relationships)
 * 
 * This is a dev/admin tool to verify the data is wired correctly.
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const diagnostics: Record<string, any> = {}

    // Collection counts
    const collectionCounts: Record<string, number> = {}
    const collections = [
      { key: 'users', name: FIRESTORE_COLLECTIONS.users },
      { key: 'teams', name: FIRESTORE_COLLECTIONS.teams },
      { key: 'sessions', name: FIRESTORE_COLLECTIONS.sessions },
      { key: 'aiJobs', name: FIRESTORE_COLLECTIONS.aiJobs },
      { key: 'subscriptions', name: FIRESTORE_COLLECTIONS.subscriptions },
      { key: 'invoices', name: FIRESTORE_COLLECTIONS.invoices },
      { key: 'payments', name: FIRESTORE_COLLECTIONS.payments },
      { key: 'credits', name: FIRESTORE_COLLECTIONS.credits },
      { key: 'webhookEndpoints', name: FIRESTORE_COLLECTIONS.webhookEndpoints },
      { key: 'auditLogs', name: FIRESTORE_COLLECTIONS.auditLogs },
    ]

    for (const { key, name } of collections) {
      try {
        const snapshot = await adminDb!.collection(name).get()
        collectionCounts[key] = snapshot.size
      } catch (error) {
        collectionCounts[key] = -1 // Error indicator
        console.warn(`[Diagnostics] Could not count ${name}:`, error)
      }
    }

    diagnostics.collectionCounts = collectionCounts

    // Timestamp ranges for time-series collections
    const timestampRanges: Record<string, { oldest: string | null; newest: string | null; count: number }> = {}

    // Sessions (mindmaps) timestamp range
    try {
      const sessionsSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.sessions).get()
      let oldestSession: Date | null = null
      let newestSession: Date | null = null
      
      for (const doc of sessionsSnapshot.docs) {
        const createdAt = toDate(doc.data().createdAt)
        if (createdAt) {
          if (!oldestSession || createdAt < oldestSession) oldestSession = createdAt
          if (!newestSession || createdAt > newestSession) newestSession = createdAt
        }
      }
      
      timestampRanges.sessions = {
        oldest: oldestSession?.toISOString() || null,
        newest: newestSession?.toISOString() || null,
        count: sessionsSnapshot.size,
      }
    } catch (error) {
      timestampRanges.sessions = { oldest: null, newest: null, count: 0 }
    }

    // Users timestamp range
    try {
      const usersSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.users).get()
      let oldestUser: Date | null = null
      let newestUser: Date | null = null
      
      for (const doc of usersSnapshot.docs) {
        const createdAt = toDate(doc.data().createdAt)
        if (createdAt) {
          if (!oldestUser || createdAt < oldestUser) oldestUser = createdAt
          if (!newestUser || createdAt > newestUser) newestUser = createdAt
        }
      }
      
      timestampRanges.users = {
        oldest: oldestUser?.toISOString() || null,
        newest: newestUser?.toISOString() || null,
        count: usersSnapshot.size,
      }
    } catch (error) {
      timestampRanges.users = { oldest: null, newest: null, count: 0 }
    }

    // Teams timestamp range
    try {
      const teamsSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.teams).get()
      let oldestTeam: Date | null = null
      let newestTeam: Date | null = null
      
      for (const doc of teamsSnapshot.docs) {
        const createdAt = toDate(doc.data().createdAt)
        if (createdAt) {
          if (!oldestTeam || createdAt < oldestTeam) oldestTeam = createdAt
          if (!newestTeam || createdAt > newestTeam) newestTeam = createdAt
        }
      }
      
      timestampRanges.teams = {
        oldest: oldestTeam?.toISOString() || null,
        newest: newestTeam?.toISOString() || null,
        count: teamsSnapshot.size,
      }
    } catch (error) {
      timestampRanges.teams = { oldest: null, newest: null, count: 0 }
    }

    diagnostics.timestampRanges = timestampRanges

    // Data integrity checks
    const integrityChecks: Record<string, { status: 'ok' | 'warning' | 'error'; message: string; count?: number }> = {}

    // Check: Subscriptions reference existing teams
    try {
      const subscriptionsSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.subscriptions).get()
      const teamsSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.teams).get()
      const teamIds = new Set(teamsSnapshot.docs.map(doc => doc.id))
      
      let orphanedSubscriptions = 0
      for (const doc of subscriptionsSnapshot.docs) {
        const teamId = doc.data().workspaceId || doc.data().teamId
        if (teamId && !teamIds.has(teamId)) {
          orphanedSubscriptions++
        }
      }
      
      integrityChecks.subscriptionsToTeams = {
        status: orphanedSubscriptions === 0 ? 'ok' : 'warning',
        message: orphanedSubscriptions === 0 
          ? 'All subscriptions reference existing teams'
          : `${orphanedSubscriptions} subscription(s) reference missing teams`,
        count: orphanedSubscriptions,
      }
    } catch (error) {
      integrityChecks.subscriptionsToTeams = {
        status: 'error',
        message: 'Could not check subscription-team relationships',
      }
    }

    // Check: Paying teams have subscriptions
    try {
      const teamsSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.teams).get()
      const subscriptionsSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.subscriptions).get()
      const teamsWithSubscriptions = new Set(
        subscriptionsSnapshot.docs.map(doc => doc.data().workspaceId || doc.data().teamId).filter(Boolean)
      )
      
      let payingTeamsWithoutSubscriptions = 0
      for (const doc of teamsSnapshot.docs) {
        const plan = doc.data().plan || 'free'
        if (plan !== 'free' && !teamsWithSubscriptions.has(doc.id)) {
          payingTeamsWithoutSubscriptions++
        }
      }
      
      integrityChecks.payingTeamsSubscriptions = {
        status: payingTeamsWithoutSubscriptions === 0 ? 'ok' : 'warning',
        message: payingTeamsWithoutSubscriptions === 0
          ? 'All paying teams have subscriptions'
          : `${payingTeamsWithoutSubscriptions} paying team(s) without subscriptions`,
        count: payingTeamsWithoutSubscriptions,
      }
    } catch (error) {
      integrityChecks.payingTeamsSubscriptions = {
        status: 'error',
        message: 'Could not check team-subscription relationships',
      }
    }

    diagnostics.integrityChecks = integrityChecks

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    console.error('[Diagnostics] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch diagnostics' },
      { status: 500 }
    )
  }
}

