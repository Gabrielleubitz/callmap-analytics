"use client"

/**
 * Alert Management Page
 * 
 * View and manage alert rules and active alerts
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDateTime } from "@/lib/utils"
import { AlertTriangle, CheckCircle, XCircle, Plus, Settings } from "lucide-react"
import Link from "next/link"

interface Alert {
  id: string
  rule_id: string
  rule_name: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  metric_value: number
  threshold: number
  triggered_at: string
  acknowledged_at?: string
  acknowledged_by?: string
  resolved_at?: string
  resolved_by?: string
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/monitoring/alerts')
      if (!response.ok) {
        throw new Error('Failed to fetch alerts')
      }
      const data = await response.json()
      setAlerts(data.items || [])
    } catch (err: any) {
      console.error('[Alerts] Error:', err)
      setError(err.message || 'Failed to load alerts')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'acknowledge' }),
      })
      if (response.ok) {
        await fetchAlerts()
      }
    } catch (err) {
      console.error('[Alerts] Error acknowledging:', err)
    }
  }

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'resolve' }),
      })
      if (response.ok) {
        await fetchAlerts()
      }
    } catch (err) {
      console.error('[Alerts] Error resolving:', err)
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="h-3 w-3" /> Critical</Badge>
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warning</Badge>
      case 'info':
      default:
        return <Badge variant="outline" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Info</Badge>
    }
  }

  if (isLoading && alerts.length === 0) {
    return <LoadingState />
  }

  if (error && alerts.length === 0) {
    return <ErrorState description={error} onRetry={fetchAlerts} />
  }

  const activeAlerts = alerts.filter(a => !a.resolved_at)
  const resolvedAlerts = alerts.filter(a => a.resolved_at)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Alert Management</h1>
          <p className="text-gray-600 text-sm">
            Monitor and manage system alerts and alert rules
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings?tab=alerts">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configure Rules
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Alerts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Active Alerts ({activeAlerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getSeverityBadge(alert.severity)}
                      <span className="font-medium">{alert.rule_name}</span>
                    </div>
                    <div className="flex gap-2">
                      {!alert.acknowledged_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Value: {alert.metric_value.toFixed(2)}</span>
                    <span>Threshold: {alert.threshold}</span>
                    <span>Triggered: {formatDateTime(new Date(alert.triggered_at))}</span>
                    {alert.acknowledged_at && (
                      <span className="text-green-600">Acknowledged</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Resolved ({resolvedAlerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolvedAlerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-sm font-medium">{alert.rule_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      Resolved: {formatDateTime(new Date(alert.resolved_at!))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

