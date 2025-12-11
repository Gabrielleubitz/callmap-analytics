import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb) {
      return NextResponse.json(null)
    }

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    const userId = params.id

    // Get user
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json(null)
    }

    const data = userDoc.data()!
    const user = {
      id: userDoc.id,
      team_id: data.workspaceId || data.teamId || null,
      email: data.email || '',
      name: data.name || data.displayName || null,
      role: (data.role || 'member') as any,
      status: (data.status || (data.emailVerified ? 'active' : 'invited')) as any,
      created_at: toDate(data.createdAt) || new Date(),
      last_login_at: toDate(data.lastLoginAt || data.lastSignInTime),
      last_activity_at: toDate(data.lastActivityAt || data.lastLoginAt || data.lastSignInTime),
      // Additional fields from Firestore
      audioMinutesUsed: data.audioMinutesUsed || 0,
      mapsGenerated: data.mapsGenerated || 0,
      monthlyResetTimestamp: toDate(data.monthlyResetTimestamp),
      onboarded: data.onboarded !== undefined ? data.onboarded : false,
      plan: data.plan || 'free',
      tokenBalance: data.tokenBalance || 0,
      updatedAt: toDate(data.updatedAt),
    }

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Error fetching user detail:', error)
    return NextResponse.json(null)
  }
}

