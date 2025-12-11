/**
 * Anomaly Detection Utilities
 * 
 * Detects anomalies in key metrics by comparing current values
 * against 7-day moving averages and standard deviations
 */

import { adminDb } from '@/lib/firebase-admin'
import { toFirestoreTimestamp } from '@/lib/utils/date'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import type { DateRange } from '@/lib/types'

export interface Alert {
  id: string
  metric: string
  severity: 'warning' | 'critical'
  currentValue: number
  expectedValue: number
  deviation: number // percentage deviation
  message: string
  timestamp: Date
}

export type MetricName = 
  | 'fileConversionSuccessRate'
  | 'exportSuccessRate'
  | 'p95GenerationTime'
  | 'dailyTokenCost'
  | 'dailyMapsCreated'

interface MetricConfig {
  name: MetricName
  thresholdPercent: number // e.g., 30 = 30% deviation triggers alert
  thresholdStdDev: number // e.g., 2 = 2 standard deviations
  minIntervals: number // number of consecutive intervals before alerting
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    name: 'fileConversionSuccessRate',
    thresholdPercent: 30,
    thresholdStdDev: 2,
    minIntervals: 1,
  },
  {
    name: 'exportSuccessRate',
    thresholdPercent: 30,
    thresholdStdDev: 2,
    minIntervals: 1,
  },
  {
    name: 'p95GenerationTime',
    thresholdPercent: 50, // Generation time can vary more
    thresholdStdDev: 2,
    minIntervals: 2, // Need 2 consecutive high values
  },
  {
    name: 'dailyTokenCost',
    thresholdPercent: 50,
    thresholdStdDev: 2,
    minIntervals: 1,
  },
  {
    name: 'dailyMapsCreated',
    thresholdPercent: 40,
    thresholdStdDev: 2,
    minIntervals: 1,
  },
]

/**
 * Calculate 7-day moving average and standard deviation for a metric
 */
async function calculateMovingStats(
  metric: MetricName,
  endDate: Date
): Promise<{ mean: number; stdDev: number; values: number[] }> {
  if (!adminDb) return { mean: 0, stdDev: 0, values: [] }

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 7)

  const values: number[] = []

  // Get daily values for the past 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const value = await getMetricValueForDay(metric, date, nextDate)
    values.push(value)
  }

  // Calculate mean
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length

  // Calculate standard deviation
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev, values }
}

/**
 * Get metric value for a specific day
 */
async function getMetricValueForDay(
  metric: MetricName,
  start: Date,
  end: Date
): Promise<number> {
  if (!adminDb) return 0

  const startTimestamp = toFirestoreTimestamp(start)
  const endTimestamp = toFirestoreTimestamp(end)

  switch (metric) {
    case 'fileConversionSuccessRate': {
      const events = await adminDb!
        .collection('analyticsEvents')
        .where('type', '==', 'file_conversion')
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<', endTimestamp)
        .get()

      if (events.empty) return 100 // No failures = 100% success

      let success = 0
      let total = 0
      events.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        total++
        if (doc.data().success) success++
      })

      return total > 0 ? (success / total) * 100 : 100
    }

    case 'exportSuccessRate': {
      const events = await adminDb!
        .collection('analyticsEvents')
        .where('type', '==', 'mindmap_export')
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<', endTimestamp)
        .get()

      if (events.empty) return 100

      let success = 0
      let total = 0
      events.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        total++
        if (doc.data().success) success++
      })

      return total > 0 ? (success / total) * 100 : 100
    }

    case 'p95GenerationTime': {
      const mindmaps = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<', endTimestamp)
        .get()

      const times: number[] = []
      mindmaps.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const time = doc.data().generationTimeMs
        if (time && typeof time === 'number') {
          times.push(time)
        }
      })

      if (times.length === 0) return 0

      const sorted = [...times].sort((a, b) => a - b)
      const p95Index = Math.floor(times.length * 0.95)
      return sorted[p95Index] || 0
    }

    case 'dailyTokenCost': {
      const events = await adminDb!
        .collection('analyticsEvents')
        .where('type', '==', 'token_burn')
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<', endTimestamp)
        .get()

      let totalCost = 0
      events.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const data = doc.data()
        const tokens = data.tokensUsed || 0
        // Rough estimate: $0.001 per 1k tokens
        totalCost += (tokens / 1000) * 0.001
      })

      return totalCost
    }

    case 'dailyMapsCreated': {
      const mindmaps = await adminDb!
        .collection(FIRESTORE_COLLECTIONS.sessions)
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<', endTimestamp)
        .get()

      return mindmaps.size
    }

    default:
      return 0
  }
}

/**
 * Check for anomalies and generate alerts
 */
export async function detectAnomalies(): Promise<Alert[]> {
  const alerts: Alert[] = []
  const today = new Date()
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  for (const config of METRIC_CONFIGS) {
    try {
      // Get current value
      const currentValue = await getMetricValueForDay(config.name, todayStart, todayEnd)

      // Get 7-day stats
      const stats = await calculateMovingStats(config.name, todayStart)

      if (stats.values.length === 0) continue

      // Check for deviation
      const percentDeviation = stats.mean > 0
        ? Math.abs((currentValue - stats.mean) / stats.mean) * 100
        : 0

      const stdDevDeviation = stats.stdDev > 0
        ? Math.abs((currentValue - stats.mean) / stats.stdDev)
        : 0

      // Determine if this is an anomaly
      const isPercentAnomaly = percentDeviation >= config.thresholdPercent
      const isStdDevAnomaly = stdDevDeviation >= config.thresholdStdDev

      if (isPercentAnomaly || isStdDevAnomaly) {
        // Determine severity
        const isCritical = 
          (percentDeviation >= config.thresholdPercent * 1.5) ||
          (stdDevDeviation >= config.thresholdStdDev * 1.5)

        const severity = isCritical ? 'critical' : 'warning'

        // Generate alert message
        const direction = currentValue > stats.mean ? 'higher' : 'lower'
        const message = `${config.name} is ${percentDeviation.toFixed(1)}% ${direction} than 7-day average (${stats.mean.toFixed(2)} vs ${currentValue.toFixed(2)})`

        alerts.push({
          id: `${config.name}-${today.toISOString()}`,
          metric: config.name,
          severity,
          currentValue,
          expectedValue: stats.mean,
          deviation: percentDeviation,
          message,
          timestamp: today,
        })
      }
    } catch (error) {
      console.error(`[anomaly-detection] Error checking ${config.name}:`, error)
    }
  }

  return alerts
}

