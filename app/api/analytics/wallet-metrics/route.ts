import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { z } from 'zod'

/**
 * GET /api/analytics/wallet-metrics
 * 
 * Returns wallet movement metrics:
 * - Daily credits vs debits
 * - Total active wallets
 * - Count of users with balance below threshold
 * 
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - threshold: number (default: 1000) - balance threshold for "low balance" count
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized'), { status: 500 })
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse(body)

    if (!dateRangeResult.success) {
      return NextResponse.json(validationError(dateRangeResult.error), { status: 400 })
    }

    const { start: dateFrom, end: dateTo } = dateRangeResult.data
    const threshold = body.threshold ?? 1000 // Default threshold: 1000 tokens

    // Convert dates to Firestore timestamps
    const startTimestamp = adminDb.Timestamp.fromDate(dateFrom)
    const endTimestamp = adminDb.Timestamp.fromDate(dateTo)

    // Query wallet transactions from analyticsEvents
    const analyticsQuery = adminDb
      .collection('analyticsEvents')
      .where('eventType', '==', 'wallet_tx')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)

    const analyticsSnap = await analyticsQuery.get()

    // Aggregate daily credits and debits
    const dailyData: Record<string, { credits: number; debits: number }> = {}
    let totalCredits = 0
    let totalDebits = 0
    const uniqueUsers = new Set<string>()

    analyticsSnap.forEach((doc) => {
      const data = doc.data()
      const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp)
      const dateKey = timestamp.toISOString().split('T')[0]

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { credits: 0, debits: 0 }
      }

      const amount = data.amount || 0
      if (amount > 0) {
        dailyData[dateKey].credits += amount
        totalCredits += amount
      } else {
        dailyData[dateKey].debits += Math.abs(amount)
        totalDebits += Math.abs(amount)
      }

      if (data.userId) {
        uniqueUsers.add(data.userId)
      }
    })

    // Get count of users with balance below threshold
    const usersQuery = adminDb
      .collection('users')
      .where('tokenBalance', '<', threshold)

    const usersSnap = await usersQuery.get()
    const lowBalanceCount = usersSnap.size

    // Get total active wallets (users with tokenBalance > 0 or any transactions)
    const activeWalletsQuery = adminDb
      .collection('users')
      .where('tokenBalance', '>', 0)

    const activeWalletsSnap = await activeWalletsQuery.get()
    const activeWalletsCount = activeWalletsSnap.size

    // Format daily data as array
    const dailyBreakdown = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        credits: data.credits,
        debits: data.debits,
        net: data.credits - data.debits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return metricResponse({
      dailyBreakdown,
      totals: {
        credits: totalCredits,
        debits: totalDebits,
        net: totalCredits - totalDebits,
      },
      activeWallets: activeWalletsCount,
      lowBalanceCount,
      threshold,
      uniqueUsers: uniqueUsers.size,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[analytics/wallet-metrics] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

