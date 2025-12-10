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
    const type = body.type

    // Get credits
    let creditsSnapshot
    try {
      creditsSnapshot = await adminDb.collection('credits').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    let credits = creditsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || '',
        type: (data.type || 'manual') as any,
        amount_usd: data.amountUsd || data.amount_usd || 0,
        created_at: toDate(data.createdAt) || new Date(),
        expires_at: toDate(data.expiresAt || data.expires_at),
      }
    })

    // Apply filters
    if (teamId) {
      credits = credits.filter((c) => c.team_id === teamId)
    }

    if (type && type.length > 0) {
      credits = credits.filter((c) => type.includes(c.type))
    }

    const total = credits.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedCredits = credits.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedCredits, total })
  } catch (error: any) {
    console.error('Error fetching credits:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

