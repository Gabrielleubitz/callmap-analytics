import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { errorResponse, validationError } from '@/lib/utils/api-response'
import { verifySessionCookie } from '@/lib/auth/session'
import { validateCSRF } from '@/lib/middleware/csrf-middleware'
import { cookies } from 'next/headers'
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
    // SECURITY: Validate CSRF token (optional, can be disabled via env var)
    // Note: CSRF validation can be strict - if it fails, try setting ENABLE_CSRF_PROTECTION=false
    if (process.env.ENABLE_CSRF_PROTECTION !== 'false') {
      try {
        const csrfValidation = await validateCSRF(request)
        if (csrfValidation) {
          console.error('[admin/wallet/adjust] CSRF validation failed')
          return csrfValidation
        }
      } catch (csrfError: any) {
        // Log CSRF error but don't block if it's a configuration issue
        console.error('[admin/wallet/adjust] CSRF validation error:', csrfError)
        // In production, you might want to be stricter, but for now allow if CSRF is misconfigured
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { error: 'CSRF validation failed' },
            { status: 403 }
          )
        }
      }
    }
    
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      // SECURITY: Log permission denial
      const { logPermissionDenied } = await import('@/lib/auth/security-log')
      await logPermissionDenied(
        authResult.decodedToken?.uid || null,
        'adjust_wallet',
        `user:${params.userId}`,
        request
      )
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

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
    let previousBalance = 0
    const result = await adminDb!.runTransaction(async (transaction) => {
      const userRef = adminDb!.collection('users').doc(userId)
      const userSnap = await transaction.get(userRef)

      if (!userSnap.exists) {
        throw new Error('User not found')
      }

      const userData = userSnap.data()!
      const currentBalance = userData?.tokenBalance ?? 0
      previousBalance = currentBalance // Store for audit logging
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

    // SECURITY: Log audit trail for admin operations
    
    const auditLogRef = adminDb!.collection('auditLogs').doc()
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    auditLogRef.set({
      action: 'wallet_adjustment',
      adminUserId: decodedToken.uid,
      adminEmail: decodedToken.email || null,
      targetUserId: userId,
      details: {
        amount,
        previousBalance,
        newBalance: result.newBalance,
        note: note || 'Manual adjustment by admin',
      },
      ipAddress: clientIp,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.headers.get('user-agent') || null,
    }).catch((error) => {
      console.error('[admin/wallet/adjust] Error logging audit:', error)
    })

    // Log analytics event (non-blocking, outside transaction)
    const analyticsRef = adminDb!.collection('analyticsEvents').doc()
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

    // SECURITY: Log wallet adjustment to security events
    const { logWalletAdjustment } = await import('@/lib/auth/security-log')
    await logWalletAdjustment(
      userId,
      amount,
      note || 'Manual adjustment by admin',
      decodedToken.uid,
      request
    ).catch((error) => {
      console.error('[admin/wallet/adjust] Error logging security event:', error)
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

