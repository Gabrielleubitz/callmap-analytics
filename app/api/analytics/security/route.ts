import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { dateRangeSchema } from '@/lib/schemas'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { metricResponse, errorResponse, validationError } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/security
 * 
 * Security & Compliance Analytics
 * Returns metrics for security incidents, failed logins, audit logs, etc.
 * 
 * Uses SUPER_ADMIN_ANALYTICS_DATA_MAP.md as reference for Firestore locations
 */

interface SecurityAnalytics {
  failedLoginAttempts: number
  securityIncidents: number
  incidentsBySeverity: Record<string, number>
  incidentsByType: Record<string, number>
  auditLogCount: number
  auditLogsByAction: Record<string, number>
  dataDeletionRequests: number
  deletionRequestsByStatus: Record<string, number>
  suspiciousActivityCount: number
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

    // Failed login attempts from audit logs
    const failedLoginsSnapshot = await adminDb
      .collection('auditLogs')
      .where('action', '==', 'auth_failed')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    const failedLoginAttempts = failedLoginsSnapshot.docs.length

    // Security incidents
    const incidentsSnapshot = await adminDb
      .collection('incidents')
      .where('detectedAt', '>=', startTimestamp)
      .where('detectedAt', '<=', endTimestamp)
      .get()

    const incidents = incidentsSnapshot.docs.map(doc => doc.data())
    const securityIncidents = incidents.length

    const incidentsBySeverity: Record<string, number> = {}
    const incidentsByType: Record<string, number> = {}

    incidents.forEach((incident: any) => {
      const severity = incident.severity || 'unknown'
      incidentsBySeverity[severity] = (incidentsBySeverity[severity] || 0) + 1
      
      const type = incident.type || 'unknown'
      incidentsByType[type] = (incidentsByType[type] || 0) + 1
    })

    // Audit logs
    const auditLogsSnapshot = await adminDb
      .collection('auditLogs')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get()

    const auditLogs = auditLogsSnapshot.docs.map(doc => doc.data())
    const auditLogCount = auditLogs.length

    const auditLogsByAction: Record<string, number> = {}
    auditLogs.forEach((log: any) => {
      const action = log.action || 'unknown'
      auditLogsByAction[action] = (auditLogsByAction[action] || 0) + 1
    })

    // Data deletion requests
    const deletionRequestsSnapshot = await adminDb
      .collection('deletionRequests')
      .where('requestedAt', '>=', startTimestamp)
      .where('requestedAt', '<=', endTimestamp)
      .get()

    const deletionRequests = deletionRequestsSnapshot.docs.map(doc => doc.data())
    const dataDeletionRequests = deletionRequests.length

    const deletionRequestsByStatus: Record<string, number> = {}
    deletionRequests.forEach((req: any) => {
      const status = req.status || 'unknown'
      deletionRequestsByStatus[status] = (deletionRequestsByStatus[status] || 0) + 1
    })

    // Suspicious activity (high severity audit logs or multiple failed logins)
    const suspiciousActivityCount = auditLogs.filter((log: any) => 
      log.severity === 'high' || log.severity === 'critical'
    ).length

    const analytics: SecurityAnalytics = {
      failedLoginAttempts,
      securityIncidents,
      incidentsBySeverity,
      incidentsByType,
      auditLogCount,
      auditLogsByAction,
      dataDeletionRequests,
      deletionRequestsByStatus,
      suspiciousActivityCount,
    }

    return metricResponse(analytics)
  } catch (error: any) {
    console.error('Security analytics error:', error)
    return errorResponse(error.message || 'Failed to fetch security analytics', 500)
  }
}

