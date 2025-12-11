import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { buildCohortsForSignupWindow, calculateCohortRetention } from '@/lib/utils/cohorts'
import type { DateRange } from '@/lib/types'

/**
 * Behavior Cohorts API
 * 
 * Returns retention curves for cohorts defined by week-1 behavior:
 * - EXPORTERS_WEEK1: Users who exported in first 7 days
 * - EDITORS_3PLUS_WEEK1: Users with 3+ edits in first 7 days
 * - ONE_AND_DONE: Users with exactly 1 mindmap, 0 edits, 0 exports
 * - COLLABORATORS_WEEK1: Users who collaborated in first 7 days
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Database not initialized'), { status: 500 })
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse({
      start: body.dateFrom || body.start,
      end: body.dateTo || body.end,
    })

    if (!dateRangeResult.success) {
      return NextResponse.json(validationError(dateRangeResult.error), { status: 400 })
    }

    const dateRange: DateRange = {
      start: dateRangeResult.data.start,
      end: dateRangeResult.data.end,
    }

    const maxWeeks = body.maxWeeks || 12

    // Build cohorts for users who signed up in this window
    const cohortMap = await buildCohortsForSignupWindow(dateRange)

    // Calculate retention curves for each cohort
    const cohortCurves = await Promise.all([
      calculateCohortRetention('EXPORTERS_WEEK1', cohortMap.get('EXPORTERS_WEEK1') || [], maxWeeks),
      calculateCohortRetention('EDITORS_3PLUS_WEEK1', cohortMap.get('EDITORS_3PLUS_WEEK1') || [], maxWeeks),
      calculateCohortRetention('ONE_AND_DONE', cohortMap.get('ONE_AND_DONE') || [], maxWeeks),
      calculateCohortRetention('COLLABORATORS_WEEK1', cohortMap.get('COLLABORATORS_WEEK1') || [], maxWeeks),
    ])

    // Filter out empty cohorts
    const activeCohorts = cohortCurves.filter(c => c.size > 0)

    return metricResponse({
      cohorts: activeCohorts,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[analytics/behavior-cohorts] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

