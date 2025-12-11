import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { errorResponse, validationError } from '@/lib/utils/api-response'
import { z } from 'zod'
import * as admin from 'firebase-admin'

const adjustSchema = z.object({
  amount: z.number().int(),
  note: z.string().optional(),
})

/**
 * POST /api/admin/wallet/[userId]/adjust
 * 
 * Admin-only route to adjust a user's wallet balance.
 * Creates an adjustment transaction using Firestore transaction for atomicity.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Firebase Admin not initialized'), { status: 500 })
    }

    const userId = params.userId
    const body = await request.json()

    // Validate request
    const validationResult = adjustSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(validationError(validationResult.error), { status: 400 })
    }

    const { amount, note } = validationResult.data

    if (amount === 0) {
      return NextResponse.json(errorResponse('Amount cannot be zero', 400), { status: 400 })
    }

    // Create adjustment transaction atomically
    const result = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId)
      const userSnap = await transaction.get(userRef)

      if (!userSnap.exists) {
        throw new Error('User not found')
      }

      const userData = userSnap.data()!
      const currentBalance = userData?.tokenBalance ?? 0
      const newBalance = currentBalance + amount

      // Don't allow negative balances
      if (newBalance < 0) {
        throw new Error(`Insufficient balance. Current: ${currentBalance}, Adjustment: ${amount}`)
      }

      // Create transaction document
      const txRef = userRef.collection('walletTransactions').doc()
      const now = admin.firestore.Timestamp.now()

      const walletTx = {
        userId,
        type: amount > 0 ? 'adjustment' : 'adjustment',
        amount,
        balanceAfter: newBalance,
        source: 'manual-adjustment',
        note: note || 'Manual adjustment by admin',
        createdAt: now,
      }

      // Write transaction and update balance atomically
      transaction.set(txRef, walletTx)
      transaction.update(userRef, {
        tokenBalance: newBalance,
        updatedAt: now,
      })

      return {
        transaction: {
          id: txRef.id,
          ...walletTx,
        },
        newBalance,
        timestamp: now,
      }
    })

    // Log analytics event (non-blocking, outside transaction)
    const analyticsRef = adminDb.collection('analyticsEvents').doc()
    analyticsRef.set({
      eventType: 'wallet_tx',
      userId,
      type: 'adjustment',
      amount,
      balanceAfter: result.newBalance,
      source: 'manual-adjustment',
      timestamp: result.timestamp,
    }).catch((error) => {
      console.error('[admin/wallet/adjust] Error logging analytics:', error)
    })

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance,
    })
  } catch (error: any) {
    console.error('[admin/wallet/adjust] Error:', error)
    return NextResponse.json(
      errorResponse(error.message || 'Failed to adjust balance'),
      { status: 500 }
    )
  }
}

