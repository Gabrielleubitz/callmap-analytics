import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = params.id
    const body = await request.json()

    // Build update object
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.role !== undefined) updateData.role = body.role
    if (body.status !== undefined) updateData.status = body.status
    if (body.plan !== undefined) updateData.plan = body.plan
    if (body.onboarded !== undefined) updateData.onboarded = body.onboarded
    if (body.tokenBalance !== undefined) updateData.tokenBalance = Number(body.tokenBalance)
    if (body.audioMinutesUsed !== undefined) updateData.audioMinutesUsed = Number(body.audioMinutesUsed)
    if (body.mapsGenerated !== undefined) updateData.mapsGenerated = Number(body.mapsGenerated)
    if (body.monthlyResetTimestamp !== undefined) {
      updateData.monthlyResetTimestamp = admin.firestore.Timestamp.fromDate(new Date(body.monthlyResetTimestamp))
    }
    
    // Always update updatedAt
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp()

    // Update the user document
    await adminDb.collection('users').doc(userId).update(updateData)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

