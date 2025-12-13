"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate, formatDateTime } from "@/lib/utils"
import { useApiData } from "@/lib/hooks/useApiData"
import { getAnalyticsAlerts } from "@/lib/db"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Fetch alerts
  const alerts = useApiData(() => getAnalyticsAlerts(), [])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const response = await fetch('/api/diagnostics', {
          method: 'POST',
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch diagnostics')
        }
        
        const data = await response.json()
        setDiagnostics(data)
        setError(null)
      } catch (err: any) {
        setError(err.message || 'Failed to load diagnostics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading diagnostics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!diagnostics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">No diagnostics data available</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">System Diagnostics</h1>
        <p className="text-gray-600 text-sm max-w-3xl">
          System health check and diagnostics. View collection sizes, data integrity, and system status. 
          Use this page to verify database connectivity, check data counts, and identify any system issues.
        </p>
      </div>

      {/* Collection Counts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Collection Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {diagnostics.collectionCounts && Object.entries(diagnostics.collectionCounts).map(([key, count]: [string, any]) => (
              <div key={key}>
                <div className="text-sm text-gray-600">{key}</div>
                <div className="text-2xl font-bold">
                  {count === -1 ? (
                    <span className="text-red-600">Error</span>
                  ) : (
                    count.toLocaleString()
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Alerts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Analytics Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.isLoading ? (
            <LoadingState variant="card" />
          ) : alerts.isError ? (
            <ErrorState
              title="Failed to load alerts"
              description={alerts.error?.message}
              variant="banner"
            />
          ) : !alerts.data || alerts.data.alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>No active alerts. All metrics are within normal ranges.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total: </span>
                  <span className="font-semibold">{alerts.data.count}</span>
                </div>
                <div>
                  <span className="text-red-600">Critical: </span>
                  <span className="font-semibold">{alerts.data.criticalCount}</span>
                </div>
                <div>
                  <span className="text-yellow-600">Warning: </span>
                  <span className="font-semibold">{alerts.data.warningCount}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                {alerts.data.alerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${
                      alert.severity === 'critical'
                        ? 'border-red-300 bg-red-50'
                        : 'border-yellow-300 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          >
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="font-semibold">{alert.metric}</span>
                        </div>
                        <p className="text-sm text-gray-700">{alert.message}</p>
                        <div className="mt-2 text-xs text-gray-500">
                          Current: {typeof alert.currentValue === 'number' ? alert.currentValue.toFixed(2) : alert.currentValue} | 
                          Expected: {typeof alert.expectedValue === 'number' ? alert.expectedValue.toFixed(2) : alert.expectedValue} | 
                          Deviation: {alert.deviation.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(new Date(alert.timestamp))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timestamp Ranges */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Timestamp Ranges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {diagnostics.timestampRanges && Object.entries(diagnostics.timestampRanges).map(([key, range]: [string, any]) => (
              <div key={key} className="border-b pb-4 last:border-0">
                <div className="font-medium mb-2">{key}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Count: </span>
                    <span className="font-medium">{range.count}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Oldest: </span>
                    <span className="font-medium">
                      {range.oldest ? formatDate(new Date(range.oldest)) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Newest: </span>
                    <span className="font-medium">
                      {range.newest ? formatDate(new Date(range.newest)) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integrity Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Data Integrity Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {diagnostics.integrityChecks && Object.entries(diagnostics.integrityChecks).map(([key, check]: [string, any]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-md bg-gray-50">
                <div>
                  <div className="font-medium">{key}</div>
                  <div className="text-sm text-gray-600">{check.message}</div>
                  {check.count !== undefined && check.count > 0 && (
                    <div className="text-xs text-gray-500 mt-1">Count: {check.count}</div>
                  )}
                </div>
                <Badge
                  variant={
                    check.status === 'ok' ? 'default' :
                    check.status === 'warning' ? 'outline' :
                    'destructive'
                  }
                >
                  {check.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

