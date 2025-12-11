import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'

function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') return new Date(dateOrTimestamp)
  return null
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized', 500), { status: 500 })
    }

    const body = await request.json()
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const teamId = body.teamId
    const status = body.status

    // Store in local const so TypeScript knows it's not null
    const db = adminDb

    // Get invoices
    let invoicesSnapshot
    try {
      invoicesSnapshot = await db.collection('invoices').get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0 })
    }

    let invoices = invoicesSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        team_id: data.workspaceId || data.teamId || '',
        amount_usd: data.amountUsd || data.amount_usd || 0,
        status: (data.status || 'open') as any,
        due_date: toDate(data.dueDate || data.due_date) || new Date(),
        paid_at: toDate(data.paidAt || data.paid_at),
        period_start: toDate(data.periodStart || data.period_start) || new Date(),
        period_end: toDate(data.periodEnd || data.period_end) || new Date(),
      }
    })

    // Apply filters
    if (teamId) {
      invoices = invoices.filter((inv) => inv.team_id === teamId)
    }

    if (status && status.length > 0) {
      invoices = invoices.filter((inv) => status.includes(inv.status))
    }

    const total = invoices.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedInvoices = invoices.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedInvoices, total })
  } catch (error: any) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ data: [], total: 0 })
  }
}

