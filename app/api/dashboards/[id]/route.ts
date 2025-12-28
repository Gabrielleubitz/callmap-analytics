import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/dashboards/[id]
 * Get a specific dashboard
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const dashboardDoc = await adminDb
      .collection(FIRESTORE_COLLECTIONS.customDashboards)
      .doc(params.id)
      .get()

    if (!dashboardDoc.exists) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    }

    return NextResponse.json({ data: { id: dashboardDoc.id, ...dashboardDoc.data() } })
  } catch (error: any) {
    console.error('[Dashboards] Error:', error)
    return errorResponse(error.message || 'Failed to fetch dashboard', 500)
  }
}

/**
 * PATCH /api/dashboards/[id]
 * Update a dashboard
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const updateData: any = {
      updated_at: admin.firestore.Timestamp.now(),
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.widgets !== undefined) updateData.widgets = body.widgets
    if (body.layout !== undefined) updateData.layout = body.layout

    await adminDb
      .collection(FIRESTORE_COLLECTIONS.customDashboards)
      .doc(params.id)
      .update(updateData)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Dashboards] Error updating:', error)
    return errorResponse(error.message || 'Failed to update dashboard', 500)
  }
}

/**
 * DELETE /api/dashboards/[id]
 * Delete a dashboard
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await adminDb
      .collection(FIRESTORE_COLLECTIONS.customDashboards)
      .doc(params.id)
      .delete()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Dashboards] Error deleting:', error)
    return errorResponse(error.message || 'Failed to delete dashboard', 500)
  }
}

