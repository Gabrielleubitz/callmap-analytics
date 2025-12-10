import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

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
    const start = new Date(body.start)
    const end = new Date(body.end)
    const startTimestamp = admin.firestore.Timestamp.fromDate(start)
    const endTimestamp = admin.firestore.Timestamp.fromDate(end)

    // Get processing jobs in range
    let jobsSnapshot
    try {
      jobsSnapshot = await adminDb
        .collection('processingJobs')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, get all and filter
      const allJobs = await adminDb.collection('processingJobs').get()
      jobsSnapshot = {
        docs: allJobs.docs.filter((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }),
      } as any
    }

    let totalJobs = 0
    let failedJobs = 0
    let longestDuration = 0
    const durationByType = new Map<string, { total: number; count: number }>()

    jobsSnapshot.forEach((doc) => {
      const data = doc.data()
      totalJobs++
      
      if (data.status === 'failed') {
        failedJobs++
      }

      const startedAt = toDate(data.startedAt)
      const finishedAt = toDate(data.finishedAt || data.completedAt)
      
      if (startedAt && finishedAt) {
        const duration = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000) // seconds
        longestDuration = Math.max(longestDuration, duration)
        
        const type = data.type || 'transcribe'
        if (!durationByType.has(type)) {
          durationByType.set(type, { total: 0, count: 0 })
        }
        const typeStats = durationByType.get(type)!
        typeStats.total += duration
        typeStats.count++
      }
    })

    const failureRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0
    const avgDurationByType = Array.from(durationByType.entries()).map(([type, stats]) => ({
      type: type as any,
      duration: stats.count > 0 ? stats.total / stats.count : 0,
    }))

    return NextResponse.json({
      failureRate,
      longestRunningJob: longestDuration,
      avgDurationByType,
    })
  } catch (error: any) {
    console.error('Error fetching AI job stats:', error)
    return NextResponse.json({
      failureRate: 0,
      longestRunningJob: 0,
      avgDurationByType: [],
    })
  }
}

