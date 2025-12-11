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

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    const teamId = params.id
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20

    // Get users for this team
    const usersSnapshot = await db
      .collection('users')
      .where('workspaceId', '==', teamId)
      .get()

    // If that doesn't work, try teamId field
    let allUsers = usersSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || teamId,
        email: data.email || '',
        name: data.name || data.displayName || null,
        role: (data.role || 'member') as any,
        status: (data.status || (data.emailVerified ? 'active' : 'invited')) as any,
        created_at: toDate(data.createdAt) || new Date(),
        last_login_at: toDate(data.lastLoginAt || data.lastSignInTime),
        last_activity_at: toDate(data.lastActivityAt || data.lastLoginAt || data.lastSignInTime),
      }
    })

    // If no users found with workspaceId, try getting all and filtering
    if (allUsers.length === 0) {
      const allUsersSnapshot = await db.collection('users').get()
      allUsers = allUsersSnapshot.docs
        .filter((doc) => {
          const data = doc.data()
          return (data.workspaceId || data.teamId) === teamId
        })
        .map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            team_id: teamId,
            email: data.email || '',
            name: data.name || data.displayName || null,
            role: (data.role || 'member') as any,
            status: (data.status || (data.emailVerified ? 'active' : 'invited')) as any,
            created_at: toDate(data.createdAt) || new Date(),
            last_login_at: toDate(data.lastLoginAt || data.lastSignInTime),
            last_activity_at: toDate(data.lastActivityAt || data.lastLoginAt || data.lastSignInTime),
          }
        })
    }

    const total = allUsers.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedUsers = allUsers.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedUsers, total })
  } catch (error: any) {
    console.error('Error fetching team users:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

