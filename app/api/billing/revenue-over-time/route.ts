import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

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

    const dailyRevenue = new Map<string, number>()

    // Get payments
    try {
      const paymentsSnapshot = await adminDb.collection('payments').get()
      paymentsSnapshot.forEach((doc) => {
        const data = doc.data()
        const createdAt = toDate(data.createdAt)
        if (createdAt >= start && createdAt <= end) {
          const dateKey = createdAt.toISOString().split('T')[0]
          const amount = data.amountUsd || data.amount_usd || 0
          dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + amount)
        }
      })
    } catch (error) {
      // If payments collection doesn't exist, try invoices
      try {
        const invoicesSnapshot = await adminDb.collection('invoices').get()
        invoicesSnapshot.forEach((doc) => {
          const data = doc.data()
          const paidAt = toDate(data.paidAt || data.paid_at)
          if (paidAt && paidAt >= start && paidAt <= end) {
            const dateKey = paidAt.toISOString().split('T')[0]
            const amount = data.amountUsd || data.amount_usd || 0
            dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + amount)
          }
        })
      } catch (invoicesError) {
        // Ignore
      }
    }

    const result = Array.from(dailyRevenue.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching revenue over time:', error)
    return NextResponse.json([])
  }
}

