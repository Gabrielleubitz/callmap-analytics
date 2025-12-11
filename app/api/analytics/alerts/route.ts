import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'
import { metricResponse, errorResponse } from '@/lib/utils/api-response'
import { detectAnomalies } from '@/lib/utils/anomaly-detection'

/**
 * Analytics Alerts API
 * 
 * Returns active alerts for key metrics based on anomaly detection
 */

export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(errorResponse('Database not initialized'), { status: 500 })
    }

    const alerts = await detectAnomalies()

    // Store alerts in Firestore for history (optional)
    try {
      const alertsRef = adminDb!.collection('analyticsAlerts')
      const batch = adminDb!.batch()

      alerts.forEach(alert => {
        const alertRef = alertsRef.doc(alert.id)
        batch.set(alertRef, {
          ...alert,
          timestamp: admin.firestore.Timestamp.now(),
        }, { merge: true })
      })

      await batch.commit()
    } catch (error) {
      // Don't fail if alert storage fails
      console.error('[analytics/alerts] Error storing alerts:', error)
    }

    return metricResponse({
      alerts,
      count: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'critical').length,
      warningCount: alerts.filter(a => a.severity === 'warning').length,
    })
  } catch (error: any) {
    console.error('[analytics/alerts] Error:', error)
    return NextResponse.json(errorResponse(error.message || 'Internal server error'), { status: 500 })
  }
}

