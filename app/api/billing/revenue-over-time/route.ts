import { NextRequest, NextResponse } from 'next/server'
import { dateRangeSchema } from '@/lib/schemas'
import { calculateDailyRevenue } from '@/lib/utils/billing'
import { validationError } from '@/lib/utils/api-response'

/**
 * Revenue Over Time API
 * 
 * Returns daily revenue totals within a date range.
 * 
 * Formula: Sum of payments/invoices grouped by date (YYYY-MM-DD)
 * Fields: payments.amountUsd, payments.createdAt OR invoices.amountUsd, invoices.paidAt
 * 
 * Uses: calculateDailyRevenue() from lib/utils/billing.ts for consistency
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate date range
    const dateRangeResult = dateRangeSchema.safeParse(body)
    if (!dateRangeResult.success) {
      return validationError(dateRangeResult.error)
    }
    
    const { start, end } = dateRangeResult.data

    // Get daily revenue using shared utility
    const dailyRevenue = await calculateDailyRevenue(start, end)

    // Transform to array and sort
    const result = Array.from(dailyRevenue.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Revenue Over Time] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch revenue over time' },
      { status: 500 }
    )
  }
}

