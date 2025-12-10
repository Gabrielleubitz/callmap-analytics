import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const limitCount = body.limit || 10

    let teamsSnapshot
    try {
      teamsSnapshot = await adminDb
        .collection('workspaces')
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get()
    } catch (error: any) {
      // If index doesn't exist, get all and sort client-side
      const allTeams = await adminDb.collection('workspaces').get()
      const sortedTeams = allTeams.docs
        .map((doc) => ({ doc, data: doc.data() }))
        .sort((a, b) => {
          const aDate = toDate(a.data.createdAt) || new Date(0)
          const bDate = toDate(b.data.createdAt) || new Date(0)
          return bDate.getTime() - aDate.getTime()
        })
        .slice(0, limitCount)
      
      teamsSnapshot = {
        docs: sortedTeams.map((item) => item.doc),
      } as any
    }

    const result = teamsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name || '',
        slug: data.slug || doc.id,
        plan: (data.plan || 'free') as any,
        created_at: toDate(data.createdAt),
        owner_user_id: data.ownerUserId || '',
        country: data.country || null,
        is_active: data.isActive !== false,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching recent teams:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recent teams' },
      { status: 500 }
    )
  }
}

