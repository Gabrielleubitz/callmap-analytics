import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/dashboards
 * List all custom dashboards
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

    const dashboardsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.customDashboards)
      .get()

    const dashboards = dashboardsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({ items: dashboards, total: dashboards.length })
  } catch (error: any) {
    console.error('[Dashboards] Error:', error)
    return errorResponse(error.message || 'Failed to fetch dashboards', 500)
  }
}

/**
 * POST /api/dashboards
 * Create a new dashboard
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

    // SECURITY: Validate request body
    const body = await request.json()
    const { dashboardCreateSchema, safeValidateRequestBody } = await import('@/lib/schemas/validation')
    const validationResult = safeValidateRequestBody(dashboardCreateSchema, body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, description, widgets, layout } = validationResult.data

    if (!name || !widgets || !Array.isArray(widgets)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, widgets' },
        { status: 400 }
      )
    }

    const dashboardRef = adminDb.collection(FIRESTORE_COLLECTIONS.customDashboards).doc()
    await dashboardRef.set({
      id: dashboardRef.id,
      name,
      description: description || null,
      widgets,
      layout: layout || null,
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      created_by: decodedToken.uid,
    })

    return NextResponse.json({ success: true, id: dashboardRef.id })
  } catch (error: any) {
    console.error('[Dashboards] Error creating:', error)
    return errorResponse(error.message || 'Failed to create dashboard', 500)
  }
}

