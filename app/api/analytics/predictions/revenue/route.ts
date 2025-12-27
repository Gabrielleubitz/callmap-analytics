import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { forecastRevenue } from '@/lib/analytics/predictions'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/predictions/revenue
 * Get revenue forecasts
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
    const period = (searchParams.get('period') || '30d') as '30d' | '60d' | '90d'

    const forecast = await forecastRevenue(period)

    return NextResponse.json({ data: forecast })
  } catch (error: any) {
    console.error('[Revenue Forecast] Error:', error)
    return errorResponse(error.message || 'Failed to forecast revenue', 500)
  }
}

