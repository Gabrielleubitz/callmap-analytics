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

    const body = await request.json()
    const { name, description, widgets, layout } = body

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

