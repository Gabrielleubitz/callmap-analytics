/**
 * Alert Rules Engine
 * 
 * Evaluates alert rules against current system metrics
 * and triggers notifications when thresholds are exceeded
 */

import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'

export interface AlertRule {
  id: string
  name: string
  description?: string
  metric: 'error_rate' | 'churn_risk' | 'token_usage' | 'job_failure_rate' | 'active_users' | 'custom'
  threshold: number
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  channels: Array<'email' | 'slack' | 'in_app'>
  enabled: boolean
  created_at: admin.firestore.Timestamp
  updated_at: admin.firestore.Timestamp
  created_by: string
}

export interface Alert {
  id: string
  rule_id: string
  rule_name: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  metric_value: number
  threshold: number
  triggered_at: admin.firestore.Timestamp
  acknowledged_at?: admin.firestore.Timestamp
  acknowledged_by?: string
  resolved_at?: admin.firestore.Timestamp
  resolved_by?: string
}

/**
 * Evaluate a single alert rule against current metrics
 */
export async function evaluateAlertRule(
  rule: AlertRule,
  currentMetrics: {
    errorRate?: number
    churnRisk?: number
    tokenUsage?: number
    jobFailureRate?: number
    activeUsers?: number
    customValue?: number
  }
): Promise<{ triggered: boolean; value: number; message: string }> {
  let value: number = 0
  let metricName = ''

  // Get current metric value
  switch (rule.metric) {
    case 'error_rate':
      value = currentMetrics.errorRate || 0
      metricName = 'Error Rate'
      break
    case 'churn_risk':
      value = currentMetrics.churnRisk || 0
      metricName = 'Churn Risk'
      break
    case 'token_usage':
      value = currentMetrics.tokenUsage || 0
      metricName = 'Token Usage'
      break
    case 'job_failure_rate':
      value = currentMetrics.jobFailureRate || 0
      metricName = 'Job Failure Rate'
      break
    case 'active_users':
      value = currentMetrics.activeUsers || 0
      metricName = 'Active Users'
      break
    case 'custom':
      value = currentMetrics.customValue || 0
      metricName = 'Custom Metric'
      break
  }

  // Evaluate threshold
  let triggered = false
  switch (rule.operator) {
    case 'gt':
      triggered = value > rule.threshold
      break
    case 'gte':
      triggered = value >= rule.threshold
      break
    case 'lt':
      triggered = value < rule.threshold
      break
    case 'lte':
      triggered = value <= rule.threshold
      break
    case 'eq':
      triggered = value === rule.threshold
      break
  }

  const message = triggered
    ? `${metricName} is ${value.toFixed(2)} (threshold: ${rule.operator} ${rule.threshold})`
    : ''

  return { triggered, value, message }
}

/**
 * Evaluate all enabled alert rules
 */
export async function evaluateAllAlertRules(
  currentMetrics: Parameters<typeof evaluateAlertRule>[1]
): Promise<Alert[]> {
  if (!adminDb) {
    console.error('[Alert Engine] Database not initialized')
    return []
  }

  try {
    // Get all enabled alert rules
    const rulesSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.alertRules)
      .where('enabled', '==', true)
      .get()

    const alerts: Alert[] = []

    for (const doc of rulesSnapshot.docs) {
      const rule = { id: doc.id, ...doc.data() } as AlertRule

      const evaluation = await evaluateAlertRule(rule, currentMetrics)

      if (evaluation.triggered) {
        // Check if alert already exists and is not resolved
        const existingAlertsSnapshot = await adminDb
          .collection('alerts')
          .where('rule_id', '==', rule.id)
          .where('resolved_at', '==', null)
          .limit(1)
          .get()

        // Only create new alert if one doesn't already exist
        if (existingAlertsSnapshot.empty) {
          const alertRef = adminDb.collection('alerts').doc()
          const alert: Alert = {
            id: alertRef.id,
            rule_id: rule.id,
            rule_name: rule.name,
            severity: rule.metric === 'error_rate' || rule.metric === 'job_failure_rate' ? 'critical' : 'warning',
            message: evaluation.message,
            metric_value: evaluation.value,
            threshold: rule.threshold,
            triggered_at: admin.firestore.Timestamp.now(),
          }

          await alertRef.set(alert)
          alerts.push(alert)

          // TODO: Send notifications via configured channels
          // await sendAlertNotifications(alert, rule)
        }
      }
    }

    return alerts
  } catch (error) {
    console.error('[Alert Engine] Error evaluating rules:', error)
    return []
  }
}

/**
 * Get all active (unresolved) alerts
 */
export async function getActiveAlerts(limit: number = 50): Promise<Alert[]> {
  if (!adminDb) {
    return []
  }

  try {
    const alertsSnapshot = await adminDb
      .collection('alerts')
      .where('resolved_at', '==', null)
      .orderBy('triggered_at', 'desc')
      .limit(limit)
      .get()

    return alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Alert[]
  } catch (error) {
    console.error('[Alert Engine] Error fetching alerts:', error)
    return []
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  if (!adminDb) {
    return false
  }

  try {
    await adminDb.collection('alerts').doc(alertId).update({
      acknowledged_at: admin.firestore.Timestamp.now(),
      acknowledged_by: userId,
    })
    return true
  } catch (error) {
    console.error('[Alert Engine] Error acknowledging alert:', error)
    return false
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string, userId: string): Promise<boolean> {
  if (!adminDb) {
    return false
  }

  try {
    await adminDb.collection('alerts').doc(alertId).update({
      resolved_at: admin.firestore.Timestamp.now(),
      resolved_by: userId,
    })
    return true
  } catch (error) {
    console.error('[Alert Engine] Error resolving alert:', error)
    return false
  }
}

