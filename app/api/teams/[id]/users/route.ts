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

    // Primary source of truth: workspace members subcollection
    const membersSnapshot = await db
      .collection('workspaces')
      .doc(teamId)
      .collection('members')
      .get()

    let allUsers: any[] = []

    if (!membersSnapshot.empty) {
      // For each member, load the corresponding user document
      const memberEntries = await Promise.all(
        membersSnapshot.docs.map(async (memberDoc) => {
          const memberData = memberDoc.data() as { userId?: string; role?: string }
          const userId = memberData.userId || memberDoc.id

          try {
            const userSnap = await db.collection('users').doc(userId).get()
            const userData = userSnap.data() || {}

            const memberRole = (memberData.role || userData.role || 'member') as string

            // Map workspace roles to analytics user roles
            let mappedRole: string
            switch (memberRole) {
              case 'owner':
                mappedRole = 'owner'
                break
              case 'manager':
              case 'admin':
                mappedRole = 'admin'
                break
              default:
                mappedRole = 'member'
            }

            return {
              id: userSnap.id,
              team_id: teamId,
              email: userData.email || '',
              name: userData.name || userData.displayName || null,
              role: mappedRole as any,
              status: (userData.status || (userData.emailVerified ? 'active' : 'invited')) as any,
              created_at: toDate(userData.createdAt) || new Date(),
              last_login_at: toDate(userData.lastLoginAt || userData.lastSignInTime),
              last_activity_at: toDate(
                userData.lastActivityAt || userData.lastLoginAt || userData.lastSignInTime
              ),
            }
          } catch (error) {
            console.warn('[Teams] Failed to load user for member', { teamId, userId, error })
            return null
          }
        })
      )

      allUsers = memberEntries.filter((u) => u !== null) as any[]
    }

    // Fallback: legacy behavior using workspaceId / teamId on user docs
    if (allUsers.length === 0) {
      const usersSnapshot = await db
        .collection('users')
        .where('workspaceId', '==', teamId)
        .get()

      allUsers = usersSnapshot.docs.map((doc) => {
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
              last_activity_at: toDate(
                data.lastActivityAt || data.lastLoginAt || data.lastSignInTime
              ),
            }
          })
      }
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


