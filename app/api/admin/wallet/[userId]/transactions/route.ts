import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { paginatedResponse, errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/admin/wallet/[userId]/transactions
 * 
 * Admin-only route to get wallet transactions for any user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized'), { status: 500 })
    }

    const userId = params.userId
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

    // Get wallet transactions
    const transactionsRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('walletTransactions')
      .orderBy('createdAt', 'desc')
      .limit(pageSize)

    const transactionsSnap = await transactionsRef.get()
    const transactions = transactionsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Get total count
    const countSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('walletTransactions')
      .count()
      .get()
    const total = countSnap.data().count

    return paginatedResponse(transactions, total, page, pageSize)
  } catch (error: any) {
    console.error('[admin/wallet/transactions] Error:', error)
    return NextResponse.json(
      errorResponse(error.message || 'Failed to fetch transactions'),
      { status: 500 }
    )
  }
}

