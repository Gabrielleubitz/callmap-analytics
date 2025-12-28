import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { getActiveAlerts, acknowledgeAlert, resolveAlert, type AlertRule, type Alert } from '@/lib/alerts/engine'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/monitoring/alerts
 * Get all active alerts
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    const alerts = await getActiveAlerts(100)

    return NextResponse.json({ items: alerts, total: alerts.length })
  } catch (error: any) {
    console.error('[Monitoring Alerts] Error:', error)
    return errorResponse(error.message || 'Failed to fetch alerts', 500)
  }
}

/**
 * POST /api/monitoring/alerts
 * Create a new alert rule
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, description, metric, threshold, operator, channels, enabled } = body

    if (!name || !metric || threshold === undefined || !operator) {
      return NextResponse.json(
        { error: 'Missing required fields: name, metric, threshold, operator' },
        { status: 400 }
      )
    }

    const ruleRef = adminDb.collection(FIRESTORE_COLLECTIONS.alertRules).doc()
    const rule: AlertRule = {
      id: ruleRef.id,
      name,
      description: description || null,
      metric,
      threshold,
      operator,
      channels: channels || ['in_app'],
      enabled: enabled !== undefined ? enabled : true,
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      created_by: decodedToken.uid,
    }

    await ruleRef.set(rule)

    return NextResponse.json({ success: true, id: ruleRef.id, rule })
  } catch (error: any) {
    console.error('[Monitoring Alerts] Error creating rule:', error)
    return errorResponse(error.message || 'Failed to create alert rule', 500)
  }
}

/**
 * PATCH /api/monitoring/alerts
 * Acknowledge or resolve an alert
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    const body = await request.json()
    const { alertId, action } = body

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, action' },
        { status: 400 }
      )
    }

    let success = false
    if (action === 'acknowledge') {
      success = await acknowledgeAlert(alertId, decodedToken.uid)
    } else if (action === 'resolve') {
      success = await resolveAlert(alertId, decodedToken.uid)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "acknowledge" or "resolve"' },
        { status: 400 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Monitoring Alerts] Error updating alert:', error)
    return errorResponse(error.message || 'Failed to update alert', 500)
  }
}

