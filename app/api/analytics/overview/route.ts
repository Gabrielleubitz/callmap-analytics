import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    // Get total users
    const usersSnapshot = await adminDb.collection('users').get()
    const total_users = usersSnapshot.size

    // Get new registrations in range
    const newUsersSnapshot = await adminDb
      .collection('users')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
    const new_registrations = newUsersSnapshot.size

    // Get active users (users with lastLoginAt in range)
    // Note: Some users might not have lastLoginAt, so we'll count those with the field
    let active_users = 0
    try {
      const activeUsersSnapshot = await adminDb
        .collection('users')
        .where('lastLoginAt', '>=', startTimestamp)
        .where('lastLoginAt', '<=', endTimestamp)
        .get()
      active_users = activeUsersSnapshot.size
    } catch (error) {
      // If query fails (e.g., no index), try getting all and filtering
      const allUsersSnapshot = await adminDb.collection('users').get()
      active_users = allUsersSnapshot.docs.filter((doc) => {
        const data = doc.data()
        const lastLogin = data.lastLoginAt?.toDate?.() || data.lastLoginAt
        return lastLogin && lastLogin >= start && lastLogin <= end
      }).length
    }

    // Get active teams
    const workspacesSnapshot = await adminDb.collection('workspaces').get()
    const active_teams = workspacesSnapshot.size

    // Get sessions (mindmaps) in range
    const mindmapsSnapshot = await adminDb
      .collection('mindmaps')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
    const sessions = mindmapsSnapshot.size

    // Calculate tokens and cost
    let tokens_used = 0
    let estimated_cost = 0
    
    // Try to get tokens from usage collection first
    try {
      const usageSnapshot = await adminDb.collection('usage').get()
      for (const userDoc of usageSnapshot.docs) {
        const monthsSnapshot = await userDoc.ref.collection('months').get()
        monthsSnapshot.forEach((monthDoc) => {
          const data = monthDoc.data()
          tokens_used += data.totalTokens || (data.promptTokens || 0) + (data.completionTokens || 0) || 0
        })
      }
    } catch (error) {
      // If usage collection doesn't exist or query fails, try processingJobs
      try {
        const jobsSnapshot = await adminDb
          .collection('processingJobs')
          .where('createdAt', '>=', startTimestamp)
          .where('createdAt', '<=', endTimestamp)
          .get()
        
        jobsSnapshot.forEach((doc) => {
          const data = doc.data()
          tokens_used += (data.tokensIn || 0) + (data.tokensOut || 0)
          estimated_cost += data.costUsd || data.cost || 0
        })
      } catch (jobsError) {
        // If that also fails, tokens will remain 0
        console.warn('Could not fetch token usage:', jobsError)
      }
    }

    // Estimate MRR
    let mrr_estimate = 0
    workspacesSnapshot.forEach((doc) => {
      const plan = doc.data().plan || 'free'
      if (plan === 'pro') mrr_estimate += 29
      else if (plan === 'team') mrr_estimate += 99
      else if (plan === 'enterprise') mrr_estimate += 299
    })

    return NextResponse.json({
      total_users,
      active_users,
      new_registrations,
      active_teams,
      sessions,
      tokens_used,
      estimated_cost,
      mrr_estimate,
    })
  } catch (error: any) {
    console.error('Error fetching overview:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch overview metrics' },
      { status: 500 }
    )
  }
}

