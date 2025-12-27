"use client"

/**
 * Anomaly Dashboard
 * 
 * Detailed view of detected anomalies with statistical analysis
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDateTime } from "@/lib/utils"
import { AlertTriangle, TrendingDown, TrendingUp, CheckCircle } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface Anomaly {
  id: string
  metric: string
  severity: 'warning' | 'critical'
  currentValue: number
  expectedValue: number
  deviation: number
  message: string
  timestamp: string
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnomalies = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Get insights which include anomalies
        const response = await fetch('/api/insights/generate?period=daily')
        if (!response.ok) {
          throw new Error('Failed to fetch anomalies')
        }
        const data = await response.json()
        const anomalyInsights = (data.data || []).filter((i: any) => i.type === 'anomaly')
        setAnomalies(anomalyInsights.map((a: any) => ({
          id: a.id,
          metric: a.metrics?.metric || a.title,
          severity: a.severity || 'warning',
          currentValue: a.metrics?.current || 0,
          expectedValue: a.metrics?.expected || 0,
          deviation: a.metrics?.deviation || 0,
          message: a.description,
          timestamp: a.timestamp,
        })))
      } catch (err: any) {
        console.error('[Anomalies] Error:', err)
        setError(err.message || 'Failed to load anomalies')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnomalies()
    // Refresh every 5 minutes
    const interval = setInterval(fetchAnomalies, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Critical</Badge>
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warning</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  if (isLoading && anomalies.length === 0) {
    return <LoadingState />
  }

  if (error && anomalies.length === 0) {
    return <ErrorState description={error} />
  }

  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical')
  const warningAnomalies = anomalies.filter(a => a.severity === 'warning')

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Anomaly Detection</h1>
        <p className="text-gray-600 text-sm">
          Statistical outlier detection using Z-scores and IQR methods
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{anomalies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalAnomalies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{warningAnomalies.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies List */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Anomalies</CardTitle>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No anomalies detected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {anomalies.map((anomaly) => {
                const isHigher = anomaly.currentValue > anomaly.expectedValue
                const deviationPercent = Math.abs(anomaly.deviation)

                return (
                  <div
                    key={anomaly.id}
                    className={`p-4 border rounded-lg ${
                      anomaly.severity === 'critical'
                        ? 'border-red-300 bg-red-50'
                        : 'border-yellow-300 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {isHigher ? (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-blue-500" />
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{anomaly.metric}</h3>
                          <p className="text-sm text-gray-600">{anomaly.message}</p>
                        </div>
                      </div>
                      {getSeverityBadge(anomaly.severity)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Current Value</div>
                        <div className="font-semibold">{anomaly.currentValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Expected Value</div>
                        <div className="font-semibold">{anomaly.expectedValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Deviation</div>
                        <div className={`font-semibold ${isHigher ? 'text-red-600' : 'text-blue-600'}`}>
                          {isHigher ? '+' : '-'}{deviationPercent.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Detected: {formatDateTime(new Date(anomaly.timestamp))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

