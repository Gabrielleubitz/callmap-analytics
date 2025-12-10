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

    // Get mindmaps - handle case where index might not exist
    let mindmapsSnapshot
    try {
      mindmapsSnapshot = await adminDb
        .collection('mindmaps')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, get all mindmaps and filter client-side
      const allMindmaps = await adminDb.collection('mindmaps').get()
      mindmapsSnapshot = {
        docs: allMindmaps.docs.filter((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }),
        forEach: function(callback: any) {
          this.docs.forEach(callback)
        }
      } as any
    }

    const dailyData = new Map<string, number>()
    mindmapsSnapshot.forEach((doc) => {
      const data = doc.data()
      const createdDate = toDate(data.createdAt)
      const dateKey = createdDate.toISOString().split('T')[0]
      dailyData.set(dateKey, (dailyData.get(dateKey) || 0) + 1)
    })

    const result = Array.from(dailyData.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching daily sessions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch daily sessions' },
      { status: 500 }
    )
  }
}

