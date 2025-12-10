import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const teamId = body.teamId

    // Get webhook endpoints
    let endpointsSnapshot
    try {
      endpointsSnapshot = await adminDb.collection('webhookEndpoints').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    let endpoints = endpointsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || '',
        url: data.url || '',
        event_types: data.eventTypes || data.event_types || [],
        created_at: toDate(data.createdAt) || new Date(),
        last_success_at: toDate(data.lastSuccessAt || data.last_success_at),
        last_failure_at: toDate(data.lastFailureAt || data.last_failure_at),
        is_active: data.isActive !== false,
      }
    })

    // Apply filters
    if (teamId) {
      endpoints = endpoints.filter((e) => e.team_id === teamId)
    }

    const total = endpoints.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedEndpoints = endpoints.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedEndpoints, total })
  } catch (error: any) {
    console.error('Error fetching webhook endpoints:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

