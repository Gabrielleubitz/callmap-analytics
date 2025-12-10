import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    // Get processing jobs - handle case where index might not exist
    let jobsSnapshot
    try {
      jobsSnapshot = await adminDb
        .collection('processingJobs')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, try getting from usage collection instead
      try {
        const usageSnapshot = await adminDb.collection('usage').get()
        jobsSnapshot = {
          docs: [],
          forEach: function(callback: any) {
            // Process usage data as if it were jobs
            this.docs.forEach(callback)
          }
        } as any
        
        // Get all usage data and convert to job-like format
        const allUsage: any[] = []
        for (const userDoc of usageSnapshot.docs) {
          const monthsSnapshot = await userDoc.ref.collection('months').get()
          monthsSnapshot.forEach((monthDoc) => {
            const data = monthDoc.data()
            const monthDate = new Date(data.month + '-01')
            if (monthDate >= start && monthDate <= end) {
              allUsage.push({
                id: monthDoc.id,
                data: () => ({
                  createdAt: admin.firestore.Timestamp.fromDate(monthDate),
                  model: 'gpt-4', // Default model
                  tokensIn: data.promptTokens || 0,
                  tokensOut: data.completionTokens || 0,
                })
              })
            }
          })
        }
        jobsSnapshot.docs = allUsage
      } catch (usageError) {
        // If that also fails, return empty
        jobsSnapshot = { docs: [], forEach: () => {} } as any
      }
    }

    const dailyData = new Map<string, Map<string, number>>()
    jobsSnapshot.forEach((doc) => {
      const data = doc.data()
      const createdDate = toDate(data.createdAt)
      const dateKey = createdDate.toISOString().split('T')[0]
      const model = data.model || 'unknown'
      const tokens = (data.tokensIn || 0) + (data.tokensOut || 0)

      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, new Map())
      }
      const modelMap = dailyData.get(dateKey)!
      modelMap.set(model, (modelMap.get(model) || 0) + tokens)
    })

    const result: Array<{ date: string; model: string; tokens: number }> = []
    dailyData.forEach((modelMap, date) => {
      modelMap.forEach((tokens, model) => {
        result.push({ date, model, tokens })
      })
    })

    return NextResponse.json(result.sort((a, b) => a.date.localeCompare(b.date)))
  } catch (error: any) {
    console.error('Error fetching daily tokens by model:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch daily tokens by model' },
      { status: 500 }
    )
  }
}

