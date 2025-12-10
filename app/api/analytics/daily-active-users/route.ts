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

    // Get active users - handle case where index might not exist
    let activeUsersSnapshot
    try {
      activeUsersSnapshot = await adminDb
        .collection('users')
        .where('lastLoginAt', '>=', startTimestamp)
        .where('lastLoginAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, get all users and filter client-side
      const allUsers = await adminDb.collection('users').get()
      activeUsersSnapshot = {
        docs: allUsers.docs.filter((doc) => {
          const data = doc.data()
          const lastLogin = data.lastLoginAt?.toDate?.() || data.lastLoginAt
          return lastLogin && lastLogin >= start && lastLogin <= end
        }),
        forEach: function(callback: any) {
          this.docs.forEach(callback)
        }
      } as any
    }

    // Get new users - handle case where index might not exist
    let newUsersSnapshot
    try {
      newUsersSnapshot = await adminDb
        .collection('users')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get()
    } catch (error) {
      // If query fails, get all users and filter client-side
      const allUsers = await adminDb.collection('users').get()
      newUsersSnapshot = {
        docs: allUsers.docs.filter((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          return createdAt && createdAt >= start && createdAt <= end
        }),
        forEach: function(callback: any) {
          this.docs.forEach(callback)
        }
      } as any
    }

    // Group by date
    const dailyData = new Map<string, { active: number; new: number }>()

    activeUsersSnapshot.forEach((doc) => {
      const data = doc.data()
      const loginDate = toDate(data.lastLoginAt)
      const dateKey = loginDate.toISOString().split('T')[0]
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, { active: 0, new: 0 })
      }
      dailyData.get(dateKey)!.active++
    })

    newUsersSnapshot.forEach((doc) => {
      const data = doc.data()
      const createdDate = toDate(data.createdAt)
      const dateKey = createdDate.toISOString().split('T')[0]
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, { active: 0, new: 0 })
      }
      dailyData.get(dateKey)!.new++
    })

    const result = Array.from(dailyData.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching daily active users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch daily active users' },
      { status: 500 }
    )
  }
}

