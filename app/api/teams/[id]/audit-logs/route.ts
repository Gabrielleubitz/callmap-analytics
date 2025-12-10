import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const teamId = params.id
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20

    // Get audit logs
    let logsSnapshot
    try {
      logsSnapshot = await adminDb
        .collection('auditLogs')
        .where('workspaceId', '==', teamId)
        .get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    let logs = logsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || teamId,
        user_id: data.userId || null,
        action: data.action || '',
        entity_type: data.entityType || data.entity_type || '',
        entity_id: data.entityId || data.entity_id || null,
        metadata: data.metadata || null,
        created_at: toDate(data.createdAt),
      }
    })

    const total = logs.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedLogs = logs.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedLogs, total })
  } catch (error: any) {
    console.error('Error fetching team audit logs:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

