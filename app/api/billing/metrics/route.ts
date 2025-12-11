import { NextRequest } from 'next/server'
import { dateRangeSchema, billingMetricsSchema } from '@/lib/schemas'
import {
  calculateMRR,
  countPayingTeams,
  calculateTotalRevenue,
  calculateUnpaidInvoices,
} from '@/lib/utils/billing'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * Billing Metrics API
 * 
 * Calculates high-level billing KPIs:
 * - mrr: Monthly Recurring Revenue (sum of PLAN_PRICES for all paying teams)
 * - totalRevenue: Sum of payments/invoices within date range
 * - unpaidInvoices: Sum of invoices where status !== 'paid' && status !== 'void'
 * - payingTeams: Count of teams where plan !== 'free'
 * 
 * Formulas:
 * - MRR: Uses calculateMRR() from lib/utils/billing.ts (sum of PLAN_PRICES[plan] for all workspaces)
 * - Revenue: Uses calculateTotalRevenue() from lib/utils/billing.ts (prefers invoices, falls back to payments)
 * - Unpaid: Uses calculateUnpaidInvoices() from lib/utils/billing.ts
 * - Paying Teams: Uses countPayingTeams() from lib/utils/billing.ts
 * 
 * Data sources:
 * - MRR/Paying Teams: workspaces collection
 * - Revenue: payments or invoices collections
 * - Unpaid: invoices collection
 * 
 * Uses: lib/config.ts PLAN_PRICES for MRR calculations
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

    // KPI 1: MRR
    // Formula: Sum of PLAN_PRICES[plan] for all workspaces where plan !== 'free'
    // Uses: calculateMRR() from lib/utils/billing.ts
    const mrr = await calculateMRR()

    // KPI 2: Paying Teams
    // Formula: Count of workspaces where plan !== 'free'
    // Uses: countPayingTeams() from lib/utils/billing.ts
    const payingTeams = await countPayingTeams()

    // KPI 3: Total Revenue
    // Formula: Sum of payments/invoices within date range
    // Uses: calculateTotalRevenue() from lib/utils/billing.ts
    const totalRevenue = await calculateTotalRevenue(start, end)

    // KPI 4: Unpaid Invoices
    // Formula: Sum of invoices where status !== 'paid' && status !== 'void'
    // Uses: calculateUnpaidInvoices() from lib/utils/billing.ts
    const unpaidInvoices = await calculateUnpaidInvoices()

    const result = {
      mrr,
      totalRevenue,
      unpaidInvoices,
      payingTeams,
    }

    // Validate response shape
    const validatedResult = billingMetricsSchema.parse(result)

    return metricResponse(validatedResult, {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Billing Metrics] Error:', error)
    
    if (error.name === 'ZodError') {
      return errorResponse('Data validation failed', 500, error.errors, 'VALIDATION_ERROR')
    }
    
    return errorResponse(error.message || 'Failed to fetch billing metrics', 500, error.message)
  }
}

