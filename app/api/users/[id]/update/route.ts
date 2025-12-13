import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'
import { userUpdateSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { validationError } from '@/lib/utils/api-response'

/**
 * Update user data
 * 
 * Validates the request payload and updates only safe-to-edit fields.
 * Rejects invalid plan names, roles, statuses, and ensures numeric fields are numbers.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // SECURITY: Verify session and check for admin role
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let decodedToken
    try {
      decodedToken = await verifySessionCookie(sessionCookie)
    } catch (error: any) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Check if user is admin or superAdmin
    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    const userId = params.id
    const body = await request.json()

    // Validate payload with zod
    const validationResult = userUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return validationError(validationResult.error)
    }

    const validatedData = validationResult.data

    // Build update object with only validated fields
    const updateData: Record<string, any> = {}
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.email !== undefined) updateData.email = validatedData.email
    if (validatedData.role !== undefined) updateData.role = validatedData.role
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.plan !== undefined) updateData.plan = validatedData.plan
    if (validatedData.onboarded !== undefined) updateData.onboarded = validatedData.onboarded
    if (validatedData.tokenBalance !== undefined) updateData.tokenBalance = validatedData.tokenBalance
    if (validatedData.audioMinutesUsed !== undefined) updateData.audioMinutesUsed = validatedData.audioMinutesUsed
    if (validatedData.mapsGenerated !== undefined) updateData.mapsGenerated = validatedData.mapsGenerated
    if (validatedData.monthlyResetTimestamp !== undefined) {
      updateData.monthlyResetTimestamp = toFirestoreTimestamp(new Date(validatedData.monthlyResetTimestamp))
    }
    
    // Always update updatedAt
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp()

    // Check if user exists
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get previous user data for audit logging
    const previousUserData = userDoc.data()

    // Update the user document
    await db.collection('users').doc(userId).update(updateData)

    // SECURITY: Log audit trail for user updates
    const auditLogRef = db.collection('auditLogs').doc()
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    auditLogRef.set({
      action: 'user_update',
      adminUserId: decodedToken.uid,
      adminEmail: decodedToken.email || null,
      targetUserId: userId,
      details: {
        previousData: previousUserData,
        updatedFields: updateData,
      },
      ipAddress: clientIp,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.headers.get('user-agent') || null,
    }).catch((error) => {
      console.error('[users/update] Error logging audit:', error)
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating user:', error)
    
    // Handle Firestore errors
    if (error.code === 'not-found') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

