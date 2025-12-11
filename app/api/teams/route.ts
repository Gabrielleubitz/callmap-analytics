import { NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { paginationParamsSchema } from '@/lib/schemas'
import { paginatedResponse, errorResponse, validationError } from '@/lib/utils/api-response'
import { toDate } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { Team } from '@/lib/types'

/**
 * Teams List API
 * 
 * Returns paginated list of teams with optional filters.
 * 
 * Response shape: PaginatedResponse<Team>
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const search = body.search || ''
    const plan = body.plan
    const country = body.country

    // Check if adminDb is initialized
    if (!adminDb) {
      console.error('[Teams] Firebase Admin DB not initialized')
      return errorResponse('Firebase Admin not configured', 500)
    }

    // Validate pagination params
    const paginationResult = paginationParamsSchema.safeParse({ page, pageSize })
    if (!paginationResult.success) {
      return validationError(paginationResult.error.errors)
    }

    // Get all workspaces
    let workspacesSnapshot
    try {
      workspacesSnapshot = await adminDb!.collection(FIRESTORE_COLLECTIONS.teams).get()
    } catch (error: any) {
      console.error('[Teams] Error fetching workspaces:', error)
      return errorResponse('Failed to fetch teams', 500, error.message)
    }

    // Filter and transform data
    let allTeams: Team[] = workspacesSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name || '',
        slug: data.slug || doc.id,
        plan: (data.plan || 'free') as any,
        created_at: toDate(data.createdAt) || new Date(),
        owner_user_id: data.ownerUserId || data.ownerId || '',
        country: data.country || null,
        is_active: data.isActive !== false,
      }
    })

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      allTeams = allTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchLower) ||
          team.slug.toLowerCase().includes(searchLower) ||
          team.id.toLowerCase().includes(searchLower)
      )
    }

    if (plan && plan.length > 0) {
      allTeams = allTeams.filter((team) => plan.includes(team.plan))
    }

    if (country && country.length > 0) {
      allTeams = allTeams.filter((team) => team.country && country.includes(team.country))
    }

    const total = allTeams.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedTeams = allTeams.slice(startIndex, endIndex)

    return paginatedResponse(paginatedTeams, total, page, pageSize)
  } catch (error: any) {
    console.error('[Teams] Unexpected error:', error)
    return errorResponse('Failed to fetch teams', 500, error.message)
  }
}

