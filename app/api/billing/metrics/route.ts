import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const start = new Date(body.start)
    const end = new Date(body.end)

    // Get all workspaces with their plans
    const workspacesSnapshot = await adminDb.collection('workspaces').get()
    
    let mrr = 0
    let payingTeams = 0
    const planPrices: Record<string, number> = {
      free: 0,
      pro: 29,
      team: 99,
      enterprise: 299,
    }

    workspacesSnapshot.forEach((doc) => {
      const data = doc.data()
      const plan = data.plan || 'free'
      if (plan !== 'free') {
        mrr += planPrices[plan] || 0
        payingTeams++
      }
    })

    // Get invoices (if they exist in Firestore)
    let unpaidInvoices = 0
    let totalRevenue = 0
    try {
      const invoicesSnapshot = await adminDb.collection('invoices').get()
      invoicesSnapshot.forEach((doc) => {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate?.() || data.createdAt
        if (createdAt && createdAt >= start && createdAt <= end) {
          totalRevenue += data.amountUsd || data.amount_usd || 0
        }
        if (data.status !== 'paid' && data.status !== 'void') {
          unpaidInvoices += data.amountUsd || data.amount_usd || 0
        }
      })
    } catch (error) {
      // If invoices collection doesn't exist, calculate from payments
      try {
        const paymentsSnapshot = await adminDb.collection('payments').get()
        paymentsSnapshot.forEach((doc) => {
          const data = doc.data()
          const createdAt = data.createdAt?.toDate?.() || data.createdAt
          if (createdAt && createdAt >= start && createdAt <= end) {
            totalRevenue += data.amountUsd || data.amount_usd || 0
          }
        })
      } catch (paymentsError) {
        // Ignore
      }
    }

    return NextResponse.json({
      mrr,
      totalRevenue,
      unpaidInvoices,
      payingTeams,
    })
  } catch (error: any) {
    console.error('Error fetching billing metrics:', error)
    return NextResponse.json({
      mrr: 0,
      totalRevenue: 0,
      unpaidInvoices: 0,
      payingTeams: 0,
    })
  }
}

