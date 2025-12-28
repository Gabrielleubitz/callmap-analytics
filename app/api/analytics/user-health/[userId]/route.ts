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
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    const userId = params.userId
    const healthScore = await calculateUserHealthScore(userId)

    return NextResponse.json({ data: healthScore })
  } catch (error: any) {
    console.error('[User Health] Error:', error)
    return errorResponse(error.message || 'Failed to calculate user health score', 500)
  }
}

