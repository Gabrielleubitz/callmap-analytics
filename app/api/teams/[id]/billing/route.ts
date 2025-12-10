import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const teamId = params.id

    // Get subscriptions
    let subscriptions: any[] = []
    try {
      const subscriptionsSnapshot = await adminDb
        .collection('subscriptions')
        .where('workspaceId', '==', teamId)
        .get()
      subscriptions = subscriptionsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: teamId,
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
      // If subscriptions don't exist, derive from workspace
      const workspaceDoc = await adminDb.collection('workspaces').doc(teamId).get()
      if (workspaceDoc.exists) {
        const data = workspaceDoc.data()!
        subscriptions = [{
          id: teamId,
          team_id: teamId,
          plan: (data.plan || 'free') as any,
          provider: 'internal',
          status: (data.isActive !== false ? 'active' : 'canceled') as any,
          trial_end: null,
          current_period_start: toDate(data.createdAt) || new Date(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancel_at: null,
          canceled_at: data.isActive === false ? toDate(data.updatedAt) : null,
        }]
      }
    }

    // Get invoices
    let invoices: any[] = []
    try {
      const invoicesSnapshot = await adminDb
        .collection('invoices')
        .where('workspaceId', '==', teamId)
        .get()
      invoices = invoicesSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: teamId,
          amount_usd: data.amountUsd || data.amount_usd || 0,
          status: (data.status || 'open') as any,
          due_date: toDate(data.dueDate || data.due_date) || new Date(),
          paid_at: toDate(data.paidAt || data.paid_at),
          period_start: toDate(data.periodStart || data.period_start) || new Date(),
          period_end: toDate(data.periodEnd || data.period_end) || new Date(),
        }
      })
    } catch (error) {
      // Ignore
    }

    // Get payments
    let payments: any[] = []
    try {
      const paymentsSnapshot = await adminDb
        .collection('payments')
        .where('workspaceId', '==', teamId)
        .get()
      payments = paymentsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: teamId,
          amount_usd: data.amountUsd || data.amount_usd || 0,
          provider: data.provider || 'stripe',
          provider_charge_id: data.providerChargeId || data.provider_charge_id || null,
          created_at: toDate(data.createdAt) || new Date(),
        }
      })
    } catch (error) {
      // Ignore
    }

    // Get credits
    let credits: any[] = []
    try {
      const creditsSnapshot = await adminDb
        .collection('credits')
        .where('workspaceId', '==', teamId)
        .get()
      credits = creditsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: teamId,
          type: (data.type || 'manual') as any,
          amount_usd: data.amountUsd || data.amount_usd || 0,
          created_at: toDate(data.createdAt) || new Date(),
          expires_at: toDate(data.expiresAt || data.expires_at),
        }
      })
    } catch (error) {
      // Ignore
    }

    return NextResponse.json({
      subscriptions,
      invoices,
      payments,
      credits,
    })
  } catch (error: any) {
    console.error('Error fetching team billing:', error)
    return NextResponse.json({
      subscriptions: [],
      invoices: [],
      payments: [],
      credits: [],
    })
  }
}

