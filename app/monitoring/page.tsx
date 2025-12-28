"use client"

/**
 * Consolidated Monitoring Page
 * 
 * Combines Live Monitoring and Alerts into a single unified interface
 */

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatNumber, formatDateTime } from "@/lib/utils"
import { Activity, Users, Zap, AlertTriangle, CheckCircle, XCircle, Clock, Plus, Settings } from "lucide-react"
import { AICoach } from "@/components/ai/ai-coach"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"

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

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState("live")
  
  // Live monitoring state
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ time: string; value: number; metric: string }>>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Alerts state
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  // Fetch live metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/live')
      if (!response.ok) throw new Error('Failed to fetch metrics')
      const data = await response.json()
      setMetrics(data.data)
      setLiveError(null)

      const now = new Date().toISOString()
      if (data.data) {
        setHistory(prev => {
          const newHistory = [
            ...prev,
            { time: now, value: data.data.tokenBurnRate, metric: 'tokens' },
            { time: now, value: data.data.errorRate, metric: 'errors' },
            { time: now, value: data.data.activeUsers, metric: 'users' },
          ]
          return newHistory.slice(-90)
        })
      }
    } catch (err: any) {
      setLiveError(err.message || 'Failed to load metrics')
    } finally {
      setLiveLoading(false)
    }
  }

  // Fetch alerts
  const fetchAlerts = async () => {
    setAlertsLoading(true)
    setAlertsError(null)
    try {
      const response = await fetch('/api/monitoring/alerts')
      if (!response.ok) throw new Error('Failed to fetch alerts')
      const data = await response.json()
      setAlerts(data.items || [])
    } catch (err: any) {
      setAlertsError(err.message || 'Failed to load alerts')
    } finally {
      setAlertsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "live") {
      fetchMetrics()
      intervalRef.current = setInterval(fetchMetrics, 5000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } else if (activeTab === "alerts") {
      fetchAlerts()
    }
  }, [activeTab])

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Healthy</Badge>
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Degraded</Badge>
      case 'critical':
        return <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1"><XCircle className="h-3 w-3" /> Critical</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Critical</Badge>
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Warning</Badge>
      case 'info':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Info</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  const tokenHistory = history.filter(h => h.metric === 'tokens').slice(-20)
  const errorHistory = history.filter(h => h.metric === 'errors').slice(-20)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <AICoach
          pageContext={{
            pageName: "Monitoring",
            description: "Real-time system monitoring and alert management",
            metrics: metrics ? {
              activeUsers: metrics.activeUsers,
              activeSessions: metrics.activeSessions,
              tokenBurnRate: metrics.tokenBurnRate,
              errorRate: metrics.errorRate,
              systemHealth: metrics.systemHealth.status,
            } : undefined,
          }}
        />
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold gradient-text mb-2">Monitoring</h1>
        <p className="text-slate-600 text-sm">
          Real-time system metrics, health monitoring, and alert management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Metrics
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
            {alerts.filter(a => !a.acknowledged_at && !a.resolved_at).length > 0 && (
              <Badge className="ml-1 bg-red-500 text-white">
                {alerts.filter(a => !a.acknowledged_at && !a.resolved_at).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Live Metrics Tab */}
        <TabsContent value="live" className="space-y-6">
          {liveLoading && !metrics ? (
            <LoadingState />
          ) : liveError && !metrics ? (
            <ErrorState description={liveError} onRetry={fetchMetrics} />
          ) : metrics ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live</span>
                </div>
                <span className="text-xs text-slate-400">
                  Last updated: {formatDateTime(new Date(metrics.timestamp))}
                </span>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-cyan-500" />
                      <span className="text-3xl font-bold">{formatNumber(metrics.activeUsers)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Last 5 minutes</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Active Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-500" />
                      <span className="text-3xl font-bold">{formatNumber(metrics.activeSessions)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Last 5 minutes</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Token Burn Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      <span className="text-3xl font-bold">{formatNumber(metrics.tokenBurnRate)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Tokens per minute</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-3xl font-bold">{formatNumber(metrics.errorRate)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Errors per minute</p>
                  </CardContent>
                </Card>
              </div>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700">Overall Status:</span>
                      {getHealthBadge(metrics.systemHealth.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Error Rate</div>
                      <div className="text-2xl font-bold">{metrics.systemHealth.indicators.errorRate.toFixed(2)}/min</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Job Failure Rate</div>
                      <div className="text-2xl font-bold">{(metrics.systemHealth.indicators.jobFailureRate * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 mb-1">API Latency</div>
                      <div className="text-2xl font-bold">{metrics.systemHealth.indicators.apiLatency}ms</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Token Burn Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={tokenHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
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
                    <CardTitle>Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={errorHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
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

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity Feed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {metrics.recentActivity.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
                    ) : (
                      metrics.recentActivity.map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
                        >
                          <Clock className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {activity.type}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {formatDateTime(new Date(activity.timestamp))}
                              </span>
                            </div>
                            {activity.userId && (
                              <p className="text-xs text-slate-600">
                                User: {activity.userId.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          {alertsLoading && alerts.length === 0 ? (
            <LoadingState />
          ) : alertsError && alerts.length === 0 ? (
            <ErrorState description={alertsError} onRetry={fetchAlerts} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Active Alerts</h2>
                  <p className="text-sm text-slate-600">Monitor and manage system alerts</p>
                </div>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Alert Rule
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  {alerts.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No active alerts</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="p-4 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {getSeverityBadge(alert.severity)}
                              <span className="font-medium text-slate-900">{alert.rule_name}</span>
                            </div>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(new Date(alert.triggered_at))}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <span>Value: {formatNumber(alert.metric_value)}</span>
                            <span>Threshold: {formatNumber(alert.threshold)}</span>
                            {alert.acknowledged_at && (
                              <span className="text-green-600">Acknowledged</span>
                            )}
                            {alert.resolved_at && (
                              <span className="text-blue-600">Resolved</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

