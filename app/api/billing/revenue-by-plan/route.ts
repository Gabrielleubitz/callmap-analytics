import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)

    const planRevenue = new Map<string, number>()
    const planPrices: Record<string, number> = {
      free: 0,
      pro: 29,
      team: 99,
      enterprise: 299,
    }

    // Get workspaces and calculate revenue based on plan and time
    const workspacesSnapshot = await adminDb.collection('workspaces').get()
    workspacesSnapshot.forEach((doc) => {
      const data = doc.data()
      const plan = data.plan || 'free'
      const createdAt = data.createdAt?.toDate?.() || data.createdAt
      
      if (createdAt && createdAt >= start && createdAt <= end && plan !== 'free') {
        // Calculate months in range
        const monthsInRange = Math.max(1, Math.ceil((end.getTime() - Math.max(start.getTime(), createdAt.getTime())) / (1000 * 60 * 60 * 24 * 30)))
        const revenue = (planPrices[plan] || 0) * monthsInRange
        planRevenue.set(plan, (planRevenue.get(plan) || 0) + revenue)
      }
    })

    // Also check payments/invoices
    try {
      const paymentsSnapshot = await adminDb.collection('payments').get()
      for (const doc of paymentsSnapshot.docs) {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate?.() || data.createdAt
        if (createdAt && createdAt >= start && createdAt <= end) {
          // Try to get plan from workspace
          const workspaceId = data.workspaceId || data.teamId
          if (workspaceId) {
            try {
              const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get()
              const workspaceData = workspaceDoc.data()
              const plan = workspaceData?.plan || 'free'
              if (plan !== 'free') {
                const amount = data.amountUsd || data.amount_usd || 0
                planRevenue.set(plan, (planRevenue.get(plan) || 0) + amount)
              }
            } catch (error) {
              // Ignore
            }
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    const result = Array.from(planRevenue.entries()).map(([plan, revenue]) => ({
      plan: plan as any,
      revenue,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching revenue by plan:', error)
    return NextResponse.json([])
  }
}

