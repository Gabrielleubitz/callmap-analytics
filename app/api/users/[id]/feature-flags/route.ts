import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb) {
      return NextResponse.json([])
    }

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    const userId = params.id

    // Get feature flag overrides for this user
    let overridesSnapshot
    try {
      overridesSnapshot = await db
        .collection('featureFlagOverrides')
        .where('userId', '==', userId)
        .get()
    } catch (error) {
      return NextResponse.json([])
    }

    const overrides = overridesSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        flag_id: data.flagId || data.flag_id || '',
        team_id: data.workspaceId || data.teamId || null,
        user_id: userId,
        is_enabled: data.isEnabled !== false,
      }
    })

    return NextResponse.json(overrides)
  } catch (error: any) {
    console.error('Error fetching user feature flags:', error)
    return NextResponse.json([])
  }
}

