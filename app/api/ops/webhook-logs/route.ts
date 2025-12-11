import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized', 500), { status: 500 })
    }

    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const endpointId = body.endpointId
    const statusCode = body.statusCode
    const teamId = body.teamId

    // Get webhook logs
    let logsSnapshot
    try {
      logsSnapshot = await adminDb!.collection('webhookLogs').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    let logs = logsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        endpoint_id: data.endpointId || data.endpoint_id || '',
        status_code: data.statusCode || data.status_code || null,
        attempted_at: toDate(data.attemptedAt || data.attempted_at),
        latency_ms: data.latencyMs || data.latency_ms || null,
        error_message: data.errorMessage || data.error_message || null,
      }
    })

    // Apply filters
    if (endpointId) {
      logs = logs.filter((l) => l.endpoint_id === endpointId)
    }

    if (statusCode && statusCode.length > 0) {
      logs = logs.filter((l) => l.status_code && statusCode.includes(l.status_code))
    }

    if (teamId) {
      // Would need to join with endpoints to filter by team
      // For now, skip this filter
    }

    const total = logs.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedLogs = logs.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedLogs, total })
  } catch (error: any) {
    console.error('Error fetching webhook logs:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

