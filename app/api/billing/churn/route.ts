import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized', 500), { status: 500 })
    }

    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)

    const monthlyChurn = new Map<string, number>()

    // Get subscriptions (if they exist)
    try {
      const subscriptionsSnapshot = await adminDb!.collection('subscriptions').get()
      subscriptionsSnapshot.forEach((doc) => {
        const data = doc.data()
        const canceledAt = toDate(data.canceledAt || data.canceled_at)
        if (canceledAt && canceledAt >= start && canceledAt <= end) {
          const monthKey = canceledAt.toISOString().slice(0, 7) // YYYY-MM
          monthlyChurn.set(monthKey, (monthlyChurn.get(monthKey) || 0) + 1)
        }
      })
    } catch (error) {
      // If subscriptions collection doesn't exist, check workspaces for canceled status
      try {
        const workspacesSnapshot = await adminDb!.collection('workspaces').get()
        workspacesSnapshot.forEach((doc) => {
          const data = doc.data()
          const isActive = data.isActive !== false
          const updatedAt = toDate(data.updatedAt || data.updated_at)
          
          // If workspace is inactive and was updated in range, count as churn
          if (!isActive && updatedAt && updatedAt >= start && updatedAt <= end) {
            const monthKey = updatedAt.toISOString().slice(0, 7)
            monthlyChurn.set(monthKey, (monthlyChurn.get(monthKey) || 0) + 1)
          }
        })
      } catch (workspacesError) {
        // Ignore
      }
    }

    const result = Array.from(monthlyChurn.entries())
      .map(([month, canceled]) => ({ month, canceled }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching churn:', error)
    return NextResponse.json([])
  }
}

