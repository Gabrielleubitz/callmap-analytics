import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { predictChurn } from '@/lib/analytics/predictions'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/predictions/churn
 * Get churn predictions for users
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (userId) {
      // Get prediction for single user
      const prediction = await predictChurn(userId)
      return NextResponse.json({ data: prediction })
    } else {
      // Get predictions for all users (at-risk users first)
      const usersSnapshot = await adminDb
        .collection('users')
        .limit(limit * 2)
        .get()

      const predictions = []
      for (const doc of usersSnapshot.docs) {
        try {
          const prediction = await predictChurn(doc.id)
          predictions.push(prediction)
        } catch (error) {
          console.error(`[Churn Prediction] Error for user ${doc.id}:`, error)
        }
      }

      // Sort by churn risk (highest first)
      predictions.sort((a, b) => b.churnRisk - a.churnRisk)

      return NextResponse.json({
        items: predictions.slice(0, limit),
        total: predictions.length,
      })
    }
  } catch (error: any) {
    console.error('[Churn Prediction] Error:', error)
    return errorResponse(error.message || 'Failed to predict churn', 500)
  }
}

