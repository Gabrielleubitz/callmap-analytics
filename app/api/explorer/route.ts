import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

const COLLECTION_MAP: Record<string, string> = {
  teams: 'workspaces',
  users: 'users',
  token_wallets: 'tokenWallets',
  sessions: 'mindmaps',
  ai_jobs: 'processingJobs',
  subscriptions: 'subscriptions',
  invoices: 'invoices',
  payments: 'payments',
  credits: 'credits',
  feature_flags: 'featureFlags',
  feature_flag_overrides: 'featureFlagOverrides',
  api_keys: 'apiKeys',
  webhook_endpoints: 'webhookEndpoints',
  webhook_logs: 'webhookLogs',
  audit_logs: 'auditLogs',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tableName = body.tableName
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const search = body.search || ''

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const collectionName = COLLECTION_MAP[tableName] || tableName

    // Get all documents
    let snapshot
    try {
      snapshot = await adminDb!.collection(collectionName).get()
    } catch (error) {
      return NextResponse.json({ data: [], total: 0, columns: [] })
    }

    // Transform documents
    let allRows = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
      }
    })

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      allRows = allRows.filter((row) => {
        return JSON.stringify(row).toLowerCase().includes(searchLower)
      })
    }

    // Extract columns from first row
    const columns = allRows.length > 0 ? Object.keys(allRows[0]) : []

    const total = allRows.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedRows = allRows.slice(startIndex, endIndex)

    return NextResponse.json({ data: paginatedRows, total, columns })
  } catch (error: any) {
    console.error('Error fetching table rows:', error)
    return NextResponse.json({ data: [], total: 0, columns: [] })
  }
}

