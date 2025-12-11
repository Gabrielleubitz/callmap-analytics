import { NextRequest, NextResponse } from 'next/server'
import { dateRangeSchema } from '@/lib/schemas'
import { getDailyTokenUsageByModel } from '@/lib/utils/tokens'

/**
 * Daily Tokens by Model API
 * 
 * Returns daily token usage grouped by model for the date range.
 * 
 * Formula: Sum of (tokensIn + tokensOut) from processingJobs, grouped by date and model
 * Fields: processingJobs.tokensIn, processingJobs.tokensOut, processingJobs.model, processingJobs.createdAt
 * 
 * Uses: getDailyTokenUsageByModel() from lib/utils/tokens.ts for consistency
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate date range
    const dateRangeResult = dateRangeSchema.safeParse(body)
    if (!dateRangeResult.success) {
      return NextResponse.json(
        { error: 'Invalid date range', details: dateRangeResult.error.issues },
        { status: 400 }
      )
    }
    
    const { start, end } = dateRangeResult.data

    // Get daily token usage by model using shared utility
    const dailyModelData = await getDailyTokenUsageByModel(start, end)

    // Transform to flat array format
    const result: Array<{ date: string; model: string; tokens: number }> = []
    dailyModelData.forEach((modelMap, date) => {
      modelMap.forEach((tokens, model) => {
        result.push({ date, model, tokens })
      })
    })

    // Sort by date, then by model
    result.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      return dateCompare !== 0 ? dateCompare : a.model.localeCompare(b.model)
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Daily Tokens by Model] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch daily tokens by model' },
      { status: 500 }
    )
  }
}

