import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/integrations
 * 
 * Integration Analytics
 * Returns metrics for integrations including providers, errors, sync rates, etc.
 * 
 * Uses SUPER_ADMIN_ANALYTICS_DATA_MAP.md as reference for Firestore locations
 */

interface IntegrationAnalytics {
  totalIntegrations: number
  activeIntegrations: number
  integrationsByProvider: Record<string, number>
  activeIntegrationsByProvider: Record<string, number>
  totalErrors: number
  errorsByProvider: Record<string, number>
  errorRate: number
  syncSuccessRate: number
  webhookEventsReceived: number
  webhookEventsProcessed: number
  webhookEventsFailed: number
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const body = await request.json()
    const dateRangeResult = dateRangeSchema.safeParse(body)

    if (!dateRangeResult.success) {
      return validationError(dateRangeResult.error)
    }

    const { start, end } = dateRangeResult.data
    const startTimestamp = toFirestoreTimestamp(start)
    const endTimestamp = toFirestoreTimestamp(end)

    // Query all integrations
    const integrationsSnapshot = await adminDb.collection('integrations').get()
    const allIntegrations = integrationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    const totalIntegrations = allIntegrations.length
    const activeIntegrations = allIntegrations.filter((int: any) => int.active === true).length
    
    // Group by provider
    const integrationsByProvider: Record<string, number> = {}
    const activeIntegrationsByProvider: Record<string, number> = {}
    
    allIntegrations.forEach((int: any) => {
      const provider = int.provider || 'unknown'
      integrationsByProvider[provider] = (integrationsByProvider[provider] || 0) + 1
      if (int.active === true) {
        activeIntegrationsByProvider[provider] = (activeIntegrationsByProvider[provider] || 0) + 1
      }
    })

    // Query integration logs for errors and events
    const integrationLogsSnapshot = await adminDb
      .collection('integration_logs')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    const logs = integrationLogsSnapshot.docs.map(doc => doc.data())
    
    // Calculate error metrics
    const errorLogs = logs.filter((log: any) => log.status === 'error')
    const totalErrors = errorLogs.length
    
    const errorsByProvider: Record<string, number> = {}
    errorLogs.forEach((log: any) => {
      const provider = log.provider || 'unknown'
      errorsByProvider[provider] = (errorsByProvider[provider] || 0) + 1
    })

    const errorRate = logs.length > 0 ? (totalErrors / logs.length) * 100 : 0

    // Calculate sync success rate
    const syncLogs = logs.filter((log: any) => 
      log.eventType === 'sync_started' || log.eventType === 'sync_completed' || log.eventType === 'sync_failed'
    )
    const successfulSyncs = syncLogs.filter((log: any) => log.eventType === 'sync_completed').length
    const syncSuccessRate = syncLogs.length > 0 ? (successfulSyncs / syncLogs.length) * 100 : 0

    // Webhook events
    const webhookEventsReceived = logs.filter((log: any) => log.eventType === 'webhook_received').length
    const webhookEventsProcessed = logs.filter((log: any) => log.eventType === 'webhook_processed').length
    const webhookEventsFailed = logs.filter((log: any) => log.eventType === 'webhook_failed').length

    const analytics: IntegrationAnalytics = {
      totalIntegrations,
      activeIntegrations,
      integrationsByProvider,
      activeIntegrationsByProvider,
      totalErrors,
      errorsByProvider,
      errorRate,
      syncSuccessRate,
      webhookEventsReceived,
      webhookEventsProcessed,
      webhookEventsFailed,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('Integration analytics error:', error)
    return errorResponse(error.message || 'Failed to fetch integration analytics', 500)
  }
}

