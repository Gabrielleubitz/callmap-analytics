import { NextRequest, NextResponse } from 'next/server'
import { dateRangeSchema } from '@/lib/schemas'
import { getDailyTokenUsage } from '@/lib/utils/tokens'

/**
 * Daily Tokens API
 * 
 * Returns daily token usage for the date range.
 * 
 * Formula: Sum of (tokensIn + tokensOut) from processingJobs, grouped by date
 * Fields: processingJobs.tokensIn, processingJobs.tokensOut, processingJobs.createdAt
 * 
 * Uses: getDailyTokenUsage() from lib/utils/tokens.ts for consistency
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate date range
    const dateRangeResult = dateRangeSchema.safeParse(body)
    if (!dateRangeResult.success) {
      return NextResponse.json(
        { error: 'Invalid date range', details: dateRangeResult.error.errors },
        { status: 400 }
      )
    }
    
    const { start, end } = dateRangeResult.data

    // Get daily token usage using shared utility
    const dailyData = await getDailyTokenUsage(start, end)

    // Transform to array and sort
    const result = Array.from(dailyData.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Daily Tokens] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch daily tokens' },
      { status: 500 }
    )
  }
}

