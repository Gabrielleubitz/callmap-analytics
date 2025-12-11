import { NextRequest, NextResponse } from 'next/server'
import { dateRangeSchema } from '@/lib/schemas'
import { calculateRevenueByPlan } from '@/lib/utils/billing'
import { Plan } from '@/lib/types'
import { validationError } from '@/lib/utils/api-response'

/**
 * Revenue by Plan API
 * 
 * Returns revenue grouped by subscription plan within a date range.
 * 
 * Formula: Sum of payments/invoices grouped by the plan of the team that made the payment
 * Fields: payments.amountUsd, payments.createdAt, payments.workspaceId -> workspaces.plan
 * 
 * Uses: calculateRevenueByPlan() from lib/utils/billing.ts for consistency
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

    // Get revenue by plan using shared utility
    const planRevenue = await calculateRevenueByPlan(start, end)

    // Transform to array
    const result = Array.from(planRevenue.entries()).map(([plan, revenue]) => ({
      plan: plan as Plan,
      revenue,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Revenue by Plan] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch revenue by plan' },
      { status: 500 }
    )
  }
}

