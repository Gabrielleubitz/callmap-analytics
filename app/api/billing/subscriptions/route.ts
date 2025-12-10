import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const plan = body.plan
    const status = body.status

    // Get subscriptions (if they exist) or derive from workspaces
    let subscriptions: any[] = []

    try {
      const subscriptionsSnapshot = await adminDb.collection('subscriptions').get()
      subscriptions = subscriptionsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: data.workspaceId || data.teamId || '',
          plan: (data.plan || 'free') as any,
          provider: data.provider || 'stripe',
          status: (data.status || 'active') as any,
          trial_end: toDate(data.trialEnd || data.trial_end),
          current_period_start: toDate(data.currentPeriodStart || data.current_period_start) || new Date(),
          current_period_end: toDate(data.currentPeriodEnd || data.current_period_end) || new Date(),
          cancel_at: toDate(data.cancelAt || data.cancel_at),
          canceled_at: toDate(data.canceledAt || data.canceled_at),
        }
      })
    } catch (error) {
      // If subscriptions collection doesn't exist, derive from workspaces
      const workspacesSnapshot = await adminDb.collection('workspaces').get()
      subscriptions = workspacesSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: doc.id,
          plan: (data.plan || 'free') as any,
          provider: 'internal',
          status: (data.isActive !== false ? 'active' : 'canceled') as any,
          trial_end: null,
          current_period_start: toDate(data.createdAt) || new Date(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          cancel_at: null,
          canceled_at: data.isActive === false ? toDate(data.updatedAt) : null,
        }
      })
    }

    // Apply filters
    if (plan && plan.length > 0) {
      subscriptions = subscriptions.filter((sub) => plan.includes(sub.plan))
    }

    if (status && status.length > 0) {
      subscriptions = subscriptions.filter((sub) => status.includes(sub.status))
    }

    const total = subscriptions.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedSubscriptions = subscriptions.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedSubscriptions, total })
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

