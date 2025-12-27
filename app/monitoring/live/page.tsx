"use client"

/**
 * Real-Time Monitoring Dashboard
 * 
 * Live dashboard showing real-time system metrics:
 * - Active users and sessions
 * - Token burn rate
 * - Error rate
 * - System health indicators
 * - Recent activity feed
 */

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatNumber, formatDateTime } from "@/lib/utils"
import { Activity, Users, Zap, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface LiveMetrics {
  timestamp: string
  activeUsers: number
  activeSessions: number
  tokenBurnRate: number
  errorRate: number
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical'
    indicators: {
      apiLatency: number
      errorRate: number
      jobFailureRate: number
    }
  }
  recentActivity: Array<{
    type: string
    userId?: string
    workspaceId?: string
    timestamp: string
    details: Record<string, any>
  }>
}

export default function LiveMonitoringPage() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ time: string; value: number; metric: string }>>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/live')
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      const data = await response.json()
      setMetrics(data.data)
      setError(null)

      // Add to history for charts
      const now = new Date().toISOString()
      if (data.data) {
        setHistory(prev => {
          const newHistory = [
            ...prev,
            { time: now, value: data.data.tokenBurnRate, metric: 'tokens' },
            { time: now, value: data.data.errorRate, metric: 'errors' },
            { time: now, value: data.data.activeUsers, metric: 'users' },
          ]
          // Keep last 30 data points
          return newHistory.slice(-90)
        })
      }
    } catch (err: any) {
      console.error('[Live Monitoring] Error:', err)
      setError(err.message || 'Failed to load metrics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchMetrics()

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchMetrics, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Healthy</Badge>
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Degraded</Badge>
      case 'critical':
        return <Badge className="bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="h-3 w-3" /> Critical</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading && !metrics) {
    return <LoadingState />
  }

  if (error && !metrics) {
    return <ErrorState description={error} onRetry={fetchMetrics} />
  }

  if (!metrics) {
    return null
  }

  // Prepare chart data
  const tokenHistory = history.filter(h => h.metric === 'tokens').slice(-20)
  const errorHistory = history.filter(h => h.metric === 'errors').slice(-20)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Live Monitoring</h1>
            <p className="text-gray-600 text-sm">
              Real-time system metrics and activity feed. Updates every 5 seconds.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live</span>
            </div>
            <span className="text-xs text-gray-400">
              Last updated: {formatDateTime(new Date(metrics.timestamp))}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-3xl font-bold">{formatNumber(metrics.activeUsers)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 5 minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <span className="text-3xl font-bold">{formatNumber(metrics.activeSessions)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 5 minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Token Burn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span className="text-3xl font-bold">{formatNumber(metrics.tokenBurnRate)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Tokens per minute</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-3xl font-bold">{formatNumber(metrics.errorRate)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Errors per minute</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Overall Status:</span>
              {getHealthBadge(metrics.systemHealth.status)}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Error Rate</div>
              <div className="text-2xl font-bold">{metrics.systemHealth.indicators.errorRate.toFixed(2)}/min</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Job Failure Rate</div>
              <div className="text-2xl font-bold">{(metrics.systemHealth.indicators.jobFailureRate * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">API Latency</div>
              <div className="text-2xl font-bold">{metrics.systemHealth.indicators.apiLatency}ms</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Token Burn Rate (Last 20 Updates)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tokenHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate (Last 20 Updates)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={errorHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {metrics.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              metrics.recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(new Date(activity.timestamp))}
                      </span>
                    </div>
                    {activity.userId && (
                      <p className="text-xs text-gray-600">
                        User: {activity.userId.slice(0, 8)}...
                      </p>
                    )}
                    {activity.workspaceId && (
                      <p className="text-xs text-gray-600">
                        Workspace: {activity.workspaceId.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

