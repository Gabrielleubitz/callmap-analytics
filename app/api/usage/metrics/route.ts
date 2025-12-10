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

    let totalTokensIn = 0
    let totalTokensOut = 0
    let totalCost = 0
    const modelMap = new Map<string, number>()
    let sessionCount = 0

    // Try to get from usage collection first
    try {
      const usageSnapshot = await adminDb.collection('usage').get()
      for (const userDoc of usageSnapshot.docs) {
        const monthsSnapshot = await userDoc.ref.collection('months').get()
        monthsSnapshot.forEach((monthDoc) => {
          const data = monthDoc.data()
          const monthDate = new Date(data.month + '-01')
          if (monthDate >= start && monthDate <= end) {
            const tokensIn = data.promptTokens || 0
            const tokensOut = data.completionTokens || 0
            totalTokensIn += tokensIn
            totalTokensOut += tokensOut
            const model = data.model || 'unknown'
            modelMap.set(model, (modelMap.get(model) || 0) + tokensIn + tokensOut)
          }
        })
      }
    } catch (error) {
      // Fallback to processingJobs
      try {
        const jobsSnapshot = await adminDb
          .collection('processingJobs')
          .where('createdAt', '>=', startTimestamp)
          .where('createdAt', '<=', endTimestamp)
          .get()

        jobsSnapshot.forEach((doc) => {
          const data = doc.data()
          const tokensIn = data.tokensIn || 0
          const tokensOut = data.tokensOut || 0
          totalTokensIn += tokensIn
          totalTokensOut += tokensOut
          totalCost += data.costUsd || data.cost || 0
          const model = data.model || 'unknown'
          modelMap.set(model, (modelMap.get(model) || 0) + tokensIn + tokensOut)
        })
      } catch (jobsError) {
        console.warn('Could not fetch usage metrics:', jobsError)
      }
    }

    // Get session count
    try {
      const mindmapsSnapshot = await adminDb
        .collection('mindmaps')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
      sessionCount = mindmapsSnapshot.size
    } catch (error) {
      // If query fails, try getting all and filtering
      try {
        const allMindmaps = await adminDb.collection('mindmaps').get()
        sessionCount = allMindmaps.docs.filter((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }).length
      } catch (e) {
        // Ignore
      }
    }

    const tokensByModel = Array.from(modelMap.entries()).map(([model, tokens]) => ({
      model,
      tokens,
    }))

    const avgTokensPerSession = sessionCount > 0 ? (totalTokensIn + totalTokensOut) / sessionCount : 0

    return NextResponse.json({
      totalTokensIn,
      totalTokensOut,
      tokensByModel,
      avgTokensPerSession,
      totalCost,
    })
  } catch (error: any) {
    console.error('Error fetching usage metrics:', error)
    return NextResponse.json({
      totalTokensIn: 0,
      totalTokensOut: 0,
      tokensByModel: [],
      avgTokensPerSession: 0,
      totalCost: 0,
    })
  }
}

