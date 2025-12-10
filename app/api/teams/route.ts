import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

function toDate(dateOrTimestamp: any): Date {
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const search = body.search || ''
    const plan = body.plan
    const country = body.country
    const subscriptionStatus = body.subscriptionStatus

    // Get all workspaces
    let workspacesSnapshot
    try {
      workspacesSnapshot = await adminDb.collection('workspaces').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    // Filter and transform data
    let allTeams = workspacesSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name || '',
        slug: data.slug || doc.id,
        plan: (data.plan || 'free') as any,
        created_at: toDate(data.createdAt),
        owner_user_id: data.ownerUserId || data.ownerId || '',
        country: data.country || null,
        is_active: data.isActive !== false,
      }
    })

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      allTeams = allTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchLower) ||
          team.slug.toLowerCase().includes(searchLower) ||
          team.id.toLowerCase().includes(searchLower)
      )
    }

    if (plan && plan.length > 0) {
      allTeams = allTeams.filter((team) => plan.includes(team.plan))
    }

    if (country && country.length > 0) {
      allTeams = allTeams.filter((team) => team.country && country.includes(team.country))
    }

    // Note: subscriptionStatus would need to be checked against subscriptions collection
    // For now, we'll skip this filter or implement it if subscriptions collection exists

    const total = allTeams.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedTeams = allTeams.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedTeams, total })
  } catch (error: any) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

