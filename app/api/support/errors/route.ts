/**
 * Unified Error Capture API
 * 
 * POST /api/support/errors
 * 
 * All client and server errors flow through this endpoint.
 * Automatically classifies and logs errors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { classifyError, inferAppArea } from '@/lib/support/classify'
import { logError } from '@/lib/support/file-logger'
import { SupportErrorEvent, ErrorSource } from '@/lib/types'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import * as admin from 'firebase-admin'

interface ErrorCaptureRequest {
  message: string
  stack?: string | null
  error_code?: string | null
  app_area?: string | null
  route?: string | null
  action?: string | null
  user_id?: string | null
  workspace_id?: string | null
  source: ErrorSource
  metadata?: Record<string, any> | null
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    const body: ErrorCaptureRequest = await request.json()
    
    // Validate required fields
    if (!body.message || !body.source) {
      return NextResponse.json(
        { error: 'message and source are required' },
        { status: 400 }
      )
    }

    // Infer app area if not provided
    const appArea = body.app_area || inferAppArea(body.route, body.action)
    
    // Classify error
    const classification = classifyError(
      body.message,
      appArea,
      body.error_code,
      body.metadata
    )

    // Check for existing error with same signature
    const errorSignature = `${appArea}:${body.message.substring(0, 100)}`
    const existingQuery = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrors)
      .where('app_area', '==', appArea)
      .where('message', '==', body.message)
      .limit(1)
      .get()

    let errorId: string
    let errorDoc: admin.firestore.DocumentSnapshot | null = null
    let occurrenceCount = 1

    if (!existingQuery.empty) {
      // Update existing error
      errorDoc = existingQuery.docs[0]
      errorId = errorDoc.id
      const existingData = errorDoc.data()
      occurrenceCount = ((existingData?.occurrence_count as number) || 1) + 1
      
      await errorDoc.ref.update({
        occurrence_count: occurrenceCount,
        last_seen_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        // Update classification if it changed
        expected: classification.expected,
        critical: classification.critical,
        severity: classification.severity,
      })
    } else {
      // Create new error
      const newErrorRef = adminDb
        .collection(FIRESTORE_COLLECTIONS.supportErrors)
        .doc()
      
      errorId = newErrorRef.id
      const now = admin.firestore.FieldValue.serverTimestamp()
      
      const errorData: Omit<SupportErrorEvent, 'id'> = {
        message: body.message,
        stack: body.stack || null,
        error_code: body.error_code || null,
        app_area: appArea,
        route: body.route || null,
        action: body.action || null,
        user_id: body.user_id || null,
        workspace_id: body.workspace_id || null,
        source: body.source,
        expected: classification.expected,
        critical: classification.critical,
        severity: classification.severity,
        triage_status: 'pending',
        acknowledged_at: null,
        resolved_at: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by: null,
        occurrence_count: 1,
        first_seen_at: new Date(),
        last_seen_at: new Date(),
        metadata: body.metadata || null,
        created_at: new Date(),
        updated_at: new Date(),
      }
      
      await newErrorRef.set({
        ...errorData,
        first_seen_at: now,
        last_seen_at: now,
        created_at: now,
        updated_at: now,
      })
      
      errorDoc = await newErrorRef.get()
    }

    // Log to file (async, don't block)
    if (errorDoc) {
      const errorData = errorDoc.data() as any
      const errorEvent: SupportErrorEvent = {
        id: errorId,
        ...errorData,
        first_seen_at: errorData.first_seen_at?.toDate() || new Date(),
        last_seen_at: errorData.last_seen_at?.toDate() || new Date(),
        created_at: errorData.created_at?.toDate() || new Date(),
        updated_at: errorData.updated_at?.toDate() || new Date(),
        acknowledged_at: errorData.acknowledged_at?.toDate() || null,
        resolved_at: errorData.resolved_at?.toDate() || null,
      }
      
      logError(errorEvent).catch(err => {
        console.error('[Error Capture] Failed to log to file:', err)
      })
    }

    return NextResponse.json({
      success: true,
      error_id: errorId,
      classification,
      occurrence_count: occurrenceCount,
    })
  } catch (error: any) {
    console.error('[Error Capture] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to capture error' },
      { status: 500 }
    )
  }
}

