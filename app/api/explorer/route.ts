import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'

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

// SECURITY: Only allow querying safe collections
const ALLOWED_COLLECTIONS = Object.keys(COLLECTION_MAP)

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify session and check for superAdmin role
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let decodedToken
    try {
      decodedToken = await verifySessionCookie(sessionCookie)
    } catch (error: any) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only superAdmin can use explorer
    if (decodedToken.role !== 'superAdmin') {
      return NextResponse.json(
        { error: 'Forbidden. SuperAdmin access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const tableName = body.tableName
    const page = body.page || 1
    const pageSize = body.pageSize || 20
    const search = body.search || ''

    // SECURITY: Validate and sanitize search input
    if (search && typeof search === 'string' && search.length > 1000) {
      return NextResponse.json(
        { error: 'Search query too long' },
        { status: 400 }
      )
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    // SECURITY: Only allow querying mapped collections
    if (!tableName || !COLLECTION_MAP[tableName]) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      )
    }

    const collectionName = COLLECTION_MAP[tableName]

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

    // SECURITY: Log audit trail for explorer queries
    const auditLogRef = adminDb!.collection('auditLogs').doc()
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    auditLogRef.set({
      action: 'explorer_query',
      adminUserId: decodedToken.uid,
      adminEmail: decodedToken.email || null,
      details: {
        collection: collectionName,
        tableName,
        searchQuery: search || null,
        page,
        pageSize,
        resultsCount: paginatedRows.length,
      },
      ipAddress: clientIp,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.headers.get('user-agent') || null,
    }).catch((error) => {
      console.error('[explorer] Error logging audit:', error)
    })

    return NextResponse.json({ data: paginatedRows, total, columns })
  } catch (error: any) {
    console.error('Error fetching table rows:', error)
    return NextResponse.json({ data: [], total: 0, columns: [] })
  }
}

