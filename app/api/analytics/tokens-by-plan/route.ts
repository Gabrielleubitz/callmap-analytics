import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized', 500), { status: 500 })
    }

    // Get all workspaces with their plans
    const workspacesSnapshot = await adminDb!.collection('workspaces').get()
    const planMap = new Map<string, string>()
    workspacesSnapshot.forEach((doc) => {
      planMap.set(doc.id, doc.data().plan || 'free')
    })

    // Get processing jobs in range - handle missing index
    let jobsSnapshot
    try {
      jobsSnapshot = await adminDb!
        .collection('processingJobs')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, try getting from usage collection
      try {
        const usageSnapshot = await adminDb!.collection('usage').get()
        jobsSnapshot = {
          docs: [],
          forEach: async function(callback: any) {
            for (const userDoc of usageSnapshot.docs) {
              const monthsSnapshot = await userDoc.ref.collection('months').get()
              monthsSnapshot.forEach((monthDoc) => {
                const data = monthDoc.data()
                const monthDate = new Date(data.month + '-01')
                if (monthDate >= start && monthDate <= end) {
                  callback({
                    data: () => ({
                      workspaceId: null, // Usage is per user, not workspace
                      tokensIn: data.promptTokens || 0,
                      tokensOut: data.completionTokens || 0,
                    })
                  })
                }
              })
            }
          }
        } as any
      } catch (usageError) {
        // If that also fails, return empty
        jobsSnapshot = { docs: [], forEach: () => {} } as any
      }
    }

    // Group tokens by plan
    const planTokens = new Map<string, number>()
    jobsSnapshot.forEach((doc: any) => {
      const data = doc.data()
      const workspaceId = data.workspaceId || data.workspace_id
      const plan = planMap.get(workspaceId) || 'free'
      const tokens = (data.tokensIn || 0) + (data.tokensOut || 0)
      planTokens.set(plan, (planTokens.get(plan) || 0) + tokens)
    })

    const result = Array.from(planTokens.entries())
      .map(([plan, tokens]) => ({ plan, tokens }))
      .sort((a, b) => b.tokens - a.tokens)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching tokens by plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tokens by plan' },
      { status: 500 }
    )
  }
}

