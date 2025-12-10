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

    const dailyData = new Map<string, number>()

    // Try processingJobs first
    try {
      const jobsSnapshot = await adminDb
        .collection('processingJobs')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()

      jobsSnapshot.forEach((doc) => {
        const data = doc.data()
        const createdDate = toDate(data.createdAt)
        const dateKey = createdDate.toISOString().split('T')[0]
        const tokens = (data.tokensIn || 0) + (data.tokensOut || 0)
        dailyData.set(dateKey, (dailyData.get(dateKey) || 0) + tokens)
      })
    } catch (error) {
      // Fallback to usage collection
      try {
        const usageSnapshot = await adminDb.collection('usage').get()
        for (const userDoc of usageSnapshot.docs) {
          const monthsSnapshot = await userDoc.ref.collection('months').get()
          monthsSnapshot.forEach((monthDoc) => {
            const data = monthDoc.data()
            const monthDate = new Date(data.month + '-01')
            if (monthDate >= start && monthDate <= end) {
              const dateKey = monthDate.toISOString().split('T')[0]
              const tokens = (data.promptTokens || 0) + (data.completionTokens || 0)
              dailyData.set(dateKey, (dailyData.get(dateKey) || 0) + tokens)
            }
          })
        }
      } catch (usageError) {
        // Ignore
      }
    }

    const result = Array.from(dailyData.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching daily tokens:', error)
    return NextResponse.json([])
  }
}

