import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { getAtRiskUsers, getUsersHealthScores } from '@/lib/analytics/user-health'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/user-health
 * Get health scores for users
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // 'all' | 'at_risk'
    const limit = parseInt(searchParams.get('limit') || '50')

    let healthScores

    if (filter === 'at_risk') {
      healthScores = await getAtRiskUsers(limit)
    } else {
      // Get all users and calculate scores
      const usersSnapshot = await adminDb
        .collection('users')
        .limit(limit)
        .get()

      const userIds = usersSnapshot.docs.map(doc => doc.id)
      healthScores = await getUsersHealthScores(userIds)
    }

    return NextResponse.json({ items: healthScores, total: healthScores.length })
  } catch (error: any) {
    console.error('[User Health] Error:', error)
    return errorResponse(error.message || 'Failed to fetch user health scores', 500)
  }
}

