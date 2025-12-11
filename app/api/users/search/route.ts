import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { paginatedResponse, errorResponse } from '@/lib/utils/api-response'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'

/**
 * User Search API
 * 
 * Search users by name, email, or UID
 */

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      console.error('[users/search] Database not initialized')
      return NextResponse.json(errorResponse('Database not initialized'), { status: 500 })
    }

    const body = await request.json().catch((error) => {
      console.error('[users/search] JSON parse error:', error)
      return {}
    })
    
    const query = (body.query || '').trim().toLowerCase()
    const limit = Math.min(body.limit || 10, 50) // Max 50 results

    console.log('[users/search] Request received:', { query, limit, body })

    if (!query || query.length < 2) {
      console.log('[users/search] Query too short, returning empty')
      return NextResponse.json(
        paginatedResponse([], 0, 1, limit),
        { status: 200 }
      )
    }

    const users: Array<{ id: string; email: string; name?: string; firstName?: string; lastName?: string }> = []
    const foundIds = new Set<string>()

    // Fetch a larger batch of users and filter client-side to avoid index requirements
    // This is more flexible and works without requiring Firestore composite indexes
    try {
      console.log('[users/search] Fetching users from Firestore...')
      const allUsersSnapshot = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.users)
        .limit(500) // Fetch up to 500 users for filtering
        .get()

      console.log('[users/search] Fetched', allUsersSnapshot.docs.length, 'users')

      const queryLower = query.toLowerCase()

      allUsersSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        const email = (data.email || '').toLowerCase()
        const firstName = (data.firstName || '').toLowerCase()
        const lastName = (data.lastName || '').toLowerCase()
        const name = (data.name || data.displayName || '').toLowerCase()
        const fullName = `${firstName} ${lastName}`.trim().toLowerCase()

        // Check if query matches email, firstName, lastName, name, or fullName
        const matchesEmail = email.includes(queryLower)
        const matchesFirstName = firstName.includes(queryLower)
        const matchesLastName = lastName.includes(queryLower)
        const matchesName = name.includes(queryLower)
        const matchesFullName = fullName.includes(queryLower)

        if (matchesEmail || matchesFirstName || matchesLastName || matchesName || matchesFullName) {
          if (!foundIds.has(doc.id) && users.length < limit) {
            foundIds.add(doc.id)
            users.push({
              id: doc.id,
              email: data.email || '',
              name: data.name || data.displayName || undefined,
              firstName: data.firstName,
              lastName: data.lastName,
            })
          }
        }
      })

      console.log('[users/search] Found', users.length, 'matching users')
    } catch (error: any) {
      console.error('[users/search] Error fetching users:', error)
      console.error('[users/search] Error stack:', error.stack)
      // If the above fails, try a simpler approach with just email search
      try {
        console.log('[users/search] Trying fallback email search...')
        const emailQuery = adminDb!
          .collection(FIRESTORE_COLLECTIONS.users)
          .where('email', '==', query)
          .limit(limit)

        const emailResults = await emailQuery.get()
        console.log('[users/search] Email search found', emailResults.docs.length, 'results')
        emailResults.docs.forEach((doc) => {
          const data = doc.data()
          users.push({
            id: doc.id,
            email: data.email || '',
            name: data.name || data.displayName || undefined,
            firstName: data.firstName,
            lastName: data.lastName,
          })
        })
      } catch (emailError: any) {
        console.error('[users/search] Error with email search:', emailError)
        console.error('[users/search] Email search error stack:', emailError.stack)
      }
    }

    // Sort by relevance (exact email match first, then name matches)
    users.sort((a, b) => {
      const aEmailMatch = a.email.toLowerCase().startsWith(query) ? 0 : 1
      const bEmailMatch = b.email.toLowerCase().startsWith(query) ? 0 : 1
      if (aEmailMatch !== bEmailMatch) return aEmailMatch - bEmailMatch

      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || ''
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || ''
      const aNameMatch = aName.toLowerCase().startsWith(query) ? 0 : 1
      const bNameMatch = bName.toLowerCase().startsWith(query) ? 0 : 1
      if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch

      return aName.localeCompare(bName)
    })

    console.log('[users/search] Returning', users.length, 'users')
    const response = paginatedResponse(users.slice(0, limit), users.length, 1, limit)
    console.log('[users/search] Response items:', users.length, 'total:', users.length)
    return response
  } catch (error: any) {
    console.error('[users/search] Top-level error:', error)
    console.error('[users/search] Error stack:', error.stack)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

