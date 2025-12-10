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
    const search = body.search || ''
    const role = body.role
    const status = body.status
    const hasLoggedIn = body.hasLoggedIn
    const teamId = body.teamId

    // Get all users
    let usersSnapshot
    try {
      usersSnapshot = await adminDb.collection('users').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    // Get workspaces to map team IDs to names
    const workspacesSnapshot = await adminDb.collection('workspaces').get()
    const workspaceMap = new Map<string, string>()
    workspacesSnapshot.forEach((doc) => {
      workspaceMap.set(doc.id, doc.data().name || doc.id)
    })

    // Filter and transform data
    let allUsers = usersSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || null,
        email: data.email || '',
        name: data.name || data.displayName || null,
        role: (data.role || 'member') as any,
        status: (data.status || (data.emailVerified ? 'active' : 'invited')) as any,
        created_at: toDate(data.createdAt) || new Date(),
        last_login_at: toDate(data.lastLoginAt || data.lastSignInTime),
        last_activity_at: toDate(data.lastActivityAt || data.lastLoginAt || data.lastSignInTime),
      }
    })

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      allUsers = allUsers.filter(
        (user) =>
          user.email.toLowerCase().includes(searchLower) ||
          (user.name && user.name.toLowerCase().includes(searchLower)) ||
          user.id.toLowerCase().includes(searchLower)
      )
    }

    if (role && role.length > 0) {
      allUsers = allUsers.filter((user) => role.includes(user.role))
    }

    if (status && status.length > 0) {
      allUsers = allUsers.filter((user) => status.includes(user.status))
    }

    if (hasLoggedIn !== undefined) {
      if (hasLoggedIn) {
        allUsers = allUsers.filter((user) => user.last_login_at !== null)
      } else {
        allUsers = allUsers.filter((user) => user.last_login_at === null)
      }
    }

    if (teamId) {
      allUsers = allUsers.filter((user) => user.team_id === teamId)
    }

    const total = allUsers.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedUsers = allUsers.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedUsers, total })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

