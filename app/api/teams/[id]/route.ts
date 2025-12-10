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
    const start = body.start ? new Date(body.start) : null
    const end = body.end ? new Date(body.end) : null

    // Get workspace
    const workspaceDoc = await adminDb.collection('workspaces').doc(teamId).get()
    if (!workspaceDoc.exists) {
      return NextResponse.json(null)
    }

    const data = workspaceDoc.data()!
    const team = {
      id: workspaceDoc.id,
      name: data.name || '',
      slug: data.slug || workspaceDoc.id,
      plan: (data.plan || 'free') as any,
      created_at: toDate(data.createdAt),
      owner_user_id: data.ownerUserId || data.ownerId || '',
      country: data.country || null,
      is_active: data.isActive !== false,
    }

    return NextResponse.json(team)
  } catch (error: any) {
    console.error('Error fetching team detail:', error)
    return NextResponse.json(null)
  }
}

