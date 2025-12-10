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
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const teamId = body.teamId

    // Get payments
    let paymentsSnapshot
    try {
      paymentsSnapshot = await adminDb.collection('payments').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    let payments = paymentsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || '',
        amount_usd: data.amountUsd || data.amount_usd || 0,
        provider: data.provider || 'stripe',
        provider_charge_id: data.providerChargeId || data.provider_charge_id || null,
        created_at: toDate(data.createdAt),
      }
    })

    // Apply filters
    if (teamId) {
      payments = payments.filter((p) => p.team_id === teamId)
    }

    const total = payments.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedPayments = payments.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedPayments, total })
  } catch (error: any) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

