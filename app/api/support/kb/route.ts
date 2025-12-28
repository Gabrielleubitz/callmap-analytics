/**
 * Knowledge Base CRUD API
 * 
 * GET /api/support/kb - List KB entries
 * POST /api/support/kb - Create KB entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { SupportErrorKB, ErrorSeverity } from '@/lib/types'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

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
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    const kbSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrorKB)
      .orderBy('created_at', 'desc')
      .get()

    const entries = kbSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate() || new Date(),
        updated_at: data.updated_at?.toDate() || new Date(),
      }
    })

    return NextResponse.json({ entries })
  } catch (error: any) {
    console.error('[KB] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch KB entries' },
      { status: 500 }
    )
  }
}

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
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      error_pattern,
      symptoms,
      app_area,
      expected,
      critical,
      severity,
      root_causes,
      fix_steps,
      customer_message_template,
    } = body

    if (!error_pattern || !symptoms || !root_causes || !fix_steps) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const kbRef = adminDb.collection(FIRESTORE_COLLECTIONS.supportErrorKB).doc()
    const now = admin.firestore.FieldValue.serverTimestamp()

    await kbRef.set({
      error_pattern,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
      app_area: app_area || null,
      expected: expected === true,
      critical: critical === true,
      severity: (severity || 'warning') as ErrorSeverity,
      root_causes: Array.isArray(root_causes) ? root_causes : [root_causes],
      fix_steps: Array.isArray(fix_steps) ? fix_steps : [fix_steps],
      customer_message_template: customer_message_template || '',
      created_by: decodedToken.uid,
      created_at: now,
      updated_at: now,
      usage_count: 0,
    })

    return NextResponse.json({
      success: true,
      id: kbRef.id,
    })
  } catch (error: any) {
    console.error('[KB] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create KB entry' },
      { status: 500 }
    )
  }
}

