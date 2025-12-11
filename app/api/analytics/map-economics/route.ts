import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { getTeamEconomics } from '@/lib/utils/economics'
import type { DateRange } from '@/lib/types'
import type { TeamEconomics } from '@/lib/utils/economics'

/**
 * Map Economics API
 * 
 * Returns profitability metrics per team:
 * - MRR
 * - Token costs
 * - AI margins
 * - Cost per mindmap
 * - Maps per active user
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse({
      start: body.dateFrom || body.start,
      end: body.dateTo || body.end,
    })

    if (!dateRangeResult.success) {
      return validationError(dateRangeResult.error)
    }

    const dateRange: DateRange = {
      start: dateRangeResult.data.start,
      end: dateRangeResult.data.end,
    }

    const planFilter = body.plan as string | undefined
    const teamIdFilter = body.teamId as string | undefined

    let teamsSnapshot: FirebaseFirestore.QuerySnapshot

    // If filtering by specific team, get that team directly
    if (teamIdFilter) {
      const teamDoc = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.teams)
        .doc(teamIdFilter)
        .get()
      
      if (!teamDoc.exists) {
        return metricResponse({
          teams: [],
          totals: {
            mrr: 0,
            tokenCost: 0,
            aiMargin: 0,
            mindmaps: 0,
          },
        })
      }

      // Create a fake QuerySnapshot-like object with just this doc
      teamsSnapshot = {
        docs: [teamDoc],
        empty: false,
        size: 1,
      } as any
    } else {
      // Get all teams (workspaces)
      let teamsQuery: FirebaseFirestore.Query = adminDb!.collection(FIRESTORE_COLLECTIONS.teams)

      if (planFilter) {
        teamsQuery = teamsQuery.where('plan', '==', planFilter)
      }

      teamsSnapshot = await teamsQuery.get()
    }

    // Calculate economics for each team
    const teamEconomicsPromises: Promise<TeamEconomics>[] = []

    teamsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const team = doc.data()
      const teamId = doc.id
      const teamName = team.name || team.workspaceName || 'Unknown Team'
      const teamPlan = team.plan || 'free'

      teamEconomicsPromises.push(
        getTeamEconomics(teamId, teamName, teamPlan, dateRange)
      )
    })

    const teams = await Promise.all(teamEconomicsPromises)

    // Calculate totals
    const totals = {
      mrr: teams.reduce((sum, t) => sum + t.mrr, 0),
      tokenCost: teams.reduce((sum, t) => sum + t.totalTokenCost, 0),
      aiMargin: teams.reduce((sum, t) => sum + t.aiMargin, 0),
      mindmaps: teams.reduce((sum, t) => sum + t.mindmapsCount, 0),
    }

    return metricResponse({
      teams,
      totals: {
        mrr: Math.round(totals.mrr * 100) / 100,
        tokenCost: Math.round(totals.tokenCost * 100) / 100,
        aiMargin: Math.round(totals.aiMargin * 100) / 100,
        mindmaps: totals.mindmaps,
      },
    })
  } catch (error: any) {
    console.error('[analytics/map-economics] Error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal server error'
    return errorResponse(errorMessage, 500, { name: error?.name, code: error?.code })
  }
}

