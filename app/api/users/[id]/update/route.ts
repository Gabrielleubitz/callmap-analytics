import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'
import { userUpdateSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'

/**
 * Update user data
 * 
 * Validates the request payload and updates only safe-to-edit fields.
 * Rejects invalid plan names, roles, statuses, and ensures numeric fields are numbers.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    // Update the user document
    await db.collection('users').doc(userId).update(updateData)

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

