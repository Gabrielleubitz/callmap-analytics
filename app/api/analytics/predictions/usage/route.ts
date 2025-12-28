import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { forecastUsage } from '@/lib/analytics/predictions'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/predictions/usage
 * Get usage forecasts
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const { searchParams } = new URL(request.url)
    const metric = (searchParams.get('metric') || 'tokens') as 'tokens' | 'mindmaps' | 'users'
    const period = (searchParams.get('period') || '30d') as '30d' | '60d' | '90d'

    const forecast = await forecastUsage(metric, period)

    return NextResponse.json({ data: forecast })
  } catch (error: any) {
    console.error('[Usage Forecast] Error:', error)
    return errorResponse(error.message || 'Failed to forecast usage', 500)
  }
}

