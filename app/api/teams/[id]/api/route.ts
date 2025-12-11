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
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const teamId = params.id

    // Get API keys
    let apiKeys: any[] = []
    try {
      const apiKeysSnapshot = await adminDb!
        .collection('apiKeys')
        .where('workspaceId', '==', teamId)
        .get()
      apiKeys = apiKeysSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: teamId,
          name: data.name || '',
          last_used_at: toDate(data.lastUsedAt || data.last_used_at),
          created_at: toDate(data.createdAt) || new Date(),
          is_active: data.isActive !== false,
        }
      })
    } catch (error) {
      // Ignore
    }

    // Get webhook endpoints
    let webhookEndpoints: any[] = []
    try {
      const endpointsSnapshot = await adminDb!
        .collection('webhookEndpoints')
        .where('workspaceId', '==', teamId)
        .get()
      webhookEndpoints = endpointsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: teamId,
          url: data.url || '',
          event_types: data.eventTypes || data.event_types || [],
          created_at: toDate(data.createdAt) || new Date(),
          last_success_at: toDate(data.lastSuccessAt || data.last_success_at),
          last_failure_at: toDate(data.lastFailureAt || data.last_failure_at),
          is_active: data.isActive !== false,
        }
      })
    } catch (error) {
      // Ignore
    }

    return NextResponse.json({
      apiKeys,
      webhookEndpoints,
    })
  } catch (error: any) {
    console.error('Error fetching team API:', error)
    return NextResponse.json({
      apiKeys: [],
      webhookEndpoints: [],
    })
  }
}

