import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { calculateUserHealthScore } from '@/lib/analytics/user-health'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/user-health/[userId]
 * Get health score for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const userId = params.userId
    const healthScore = await calculateUserHealthScore(userId)

    return NextResponse.json({ data: healthScore })
  } catch (error: any) {
    console.error('[User Health] Error:', error)
    return errorResponse(error.message || 'Failed to calculate user health score', 500)
  }
}

