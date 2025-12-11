import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { buildUserJourney, buildTeamJourney, type JourneyEvent } from '@/lib/utils/journeys'
import type { DateRange } from '@/lib/types'

/**
 * Journey Explorer API
 * 
 * Returns chronological timeline of events for a user or team
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Database not initialized'), { status: 500 })
    }

    const body = await request.json()
    const userId = body.userId as string | undefined
    const teamId = body.teamId as string | undefined

    if (!userId && !teamId) {
      return NextResponse.json(
        errorResponse('Either userId or teamId is required'),
        { status: 400 }
      )
    }

    const dateRangeResult = dateRangeSchema.safeParse({
      start: body.dateFrom || body.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: body.dateTo || body.end || new Date().toISOString(),
    })

    if (!dateRangeResult.success) {
      return NextResponse.json(validationError(dateRangeResult.error), { status: 400 })
    }

    const dateRange: DateRange = {
      start: dateRangeResult.data.start,
      end: dateRangeResult.data.end,
    }

    let events: JourneyEvent[] = []

    if (userId) {
      events = await buildUserJourney(userId, dateRange)
    } else if (teamId) {
      events = await buildTeamJourney(teamId, dateRange)
    }

    return metricResponse({
      events,
      count: events.length,
      entityType: userId ? 'user' : 'team',
      entityId: userId || teamId || '',
    })
  } catch (error: any) {
    console.error('[analytics/journeys] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

