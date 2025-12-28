"use client"

/**
 * Consolidated Predictions Page
 * 
 * Combines Churn, Revenue, and Usage predictions into a single unified interface
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatDateTime, formatNumber, formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { AlertTriangle, TrendingDown, Calendar, Lightbulb, TrendingUp, Minus, DollarSign, Zap, FileText, Users } from "lucide-react"
import { AICoach } from "@/components/ai/ai-coach"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
} from "recharts"

interface ChurnPrediction {
  userId: string
  churnRisk: number
  predictedChurnDate: string | null
  factors: {
    activityDrop: number
    paymentIssues: number
    featureUsage: number
    sentimentTrend: number
    errorFrequency: number
  }
  interventionRecommendations: string[]
}

interface RevenueForecast {
  period: '30d' | '60d' | '90d'
  forecastedMRR: number
  forecastedARR: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  trend: 'increasing' | 'stable' | 'decreasing'
  factors: {
    newCustomers: number
    churnRate: number
    expansionRate: number
  }
}

interface UsageForecast {
  metric: 'tokens' | 'mindmaps' | 'users'
  period: '30d' | '60d' | '90d'
  forecastedValue: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  trend: 'increasing' | 'stable' | 'decreasing'
  growthRate: number
}

export default function PredictionsPage() {
  const [activeTab, setActiveTab] = useState("churn")
  
  // Churn state
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([])
  const [churnLoading, setChurnLoading] = useState(true)
  const [churnError, setChurnError] = useState<string | null>(null)
  
  // Revenue state
  const [revenueForecasts, setRevenueForecasts] = useState<RevenueForecast[]>([])
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [revenueError, setRevenueError] = useState<string | null>(null)
  
  // Usage state
  const [usageForecasts, setUsageForecasts] = useState<UsageForecast[]>([])
  const [usageLoading, setUsageLoading] = useState(true)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<'tokens' | 'mindmaps' | 'users'>('tokens')

  // Fetch churn predictions
  useEffect(() => {
    const fetchChurn = async () => {
      setChurnLoading(true)
      setChurnError(null)
      try {
        const response = await fetch('/api/analytics/predictions/churn?limit=50')
        if (!response.ok) throw new Error('Failed to fetch churn predictions')
        const data = await response.json()
        setChurnPredictions(data.items || [])
      } catch (err: any) {
        setChurnError(err.message || 'Failed to load predictions')
      } finally {
        setChurnLoading(false)
      }
    }
    if (activeTab === "churn") fetchChurn()
  }, [activeTab])

  // Fetch revenue forecasts
  useEffect(() => {
    const fetchRevenue = async () => {
      setRevenueLoading(true)
      setRevenueError(null)
      try {
        const response = await fetch('/api/analytics/predictions/revenue')
        if (!response.ok) throw new Error('Failed to fetch revenue forecasts')
        const data = await response.json()
        setRevenueForecasts(data.forecasts || [])
      } catch (err: any) {
        setRevenueError(err.message || 'Failed to load forecasts')
      } finally {
        setRevenueLoading(false)
      }
    }
    if (activeTab === "revenue") fetchRevenue()
  }, [activeTab])

  // Fetch usage forecasts
  useEffect(() => {
    const fetchUsage = async () => {
      setUsageLoading(true)
      setUsageError(null)
      try {
        const response = await fetch('/api/analytics/predictions/usage')
        if (!response.ok) throw new Error('Failed to fetch usage forecasts')
        const data = await response.json()
        setUsageForecasts(data.forecasts || [])
      } catch (err: any) {
        setUsageError(err.message || 'Failed to load forecasts')
      } finally {
        setUsageLoading(false)
      }
    }
    if (activeTab === "usage") fetchUsage()
  }, [activeTab, selectedMetric])

  const getRiskBadge = (risk: number) => {
    if (risk >= 80) return <Badge className="bg-red-100 text-red-700 border-red-200">Critical</Badge>
    if (risk >= 60) return <Badge className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>
    if (risk >= 40) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Medium</Badge>
    return <Badge className="bg-green-100 text-green-700 border-green-200">Low</Badge>
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 80) return '#ef4444'
    if (risk >= 60) return '#f97316'
    if (risk >= 40) return '#eab308'
    return '#22c55e'
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  // Churn chart data
  const churnChartData = churnPredictions.reduce((acc, p) => {
    const range = Math.floor(p.churnRisk / 20) * 20
    const key = `${range}-${range + 19}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const churnChart = Object.entries(churnChartData).map(([range, count]) => ({
    range,
    count,
  }))

  const highRiskCount = churnPredictions.filter(p => p.churnRisk >= 60).length
  const avgRisk = churnPredictions.length > 0
    ? churnPredictions.reduce((sum, p) => sum + p.churnRisk, 0) / churnPredictions.length
    : 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <AICoach
          pageContext={{
            pageName: "Predictions",
            description: "AI-powered predictions for churn, revenue, and usage",
            metrics: activeTab === "churn" && churnPredictions.length > 0 ? {
              totalUsers: churnPredictions.length,
              averageRisk: Math.round(avgRisk),
              highRiskUsers: highRiskCount,
            } : undefined,
          }}
        />
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold gradient-text mb-2">Predictions</h1>
        <p className="text-slate-600 text-sm">
          AI-powered forecasts for churn risk, revenue, and usage trends
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="churn" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Churn Risk
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue Forecast
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Usage Forecast
          </TabsTrigger>
        </TabsList>

        {/* Churn Tab */}
        <TabsContent value="churn" className="space-y-6">
          {churnLoading && churnPredictions.length === 0 ? (
            <LoadingState />
          ) : churnError && churnPredictions.length === 0 ? (
            <ErrorState description={churnError} />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Average Churn Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <span className="text-3xl font-bold">{Math.round(avgRisk)}</span>
                      <span className="text-sm text-slate-500">/ 100</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">High Risk Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      <span className="text-3xl font-bold">{highRiskCount}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Users Analyzed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-3xl font-bold">{churnPredictions.length}</span>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Distribution Chart */}
              {churnChart.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Churn Risk Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={churnChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6">
                          {churnChart.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getRiskColor(parseInt(entry.range.split('-')[0]))} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Predictions Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Churn Risk Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  {churnPredictions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>No predictions available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/20">
                            <th className="text-left p-3 text-sm font-medium text-slate-700">User ID</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-700">Churn Risk</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-700">Predicted Date</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-700">Risk Factors</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {churnPredictions.map((prediction) => (
                            <tr key={prediction.userId} className="border-b border-white/10 hover:bg-white/20">
                              <td className="p-3">
                                <Link
                                  href={`/users/${prediction.userId}`}
                                  className="text-cyan-600 hover:text-cyan-700 hover:underline text-sm"
                                >
                                  {prediction.userId.slice(0, 12)}...
                                </Link>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: getRiskColor(prediction.churnRisk) }}
                                  />
                                  <span className="font-semibold">{prediction.churnRisk}/100</span>
                                  {getRiskBadge(prediction.churnRisk)}
                                </div>
                              </td>
                              <td className="p-3">
                                {prediction.predictedChurnDate ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    {formatDateTime(new Date(prediction.predictedChurnDate))}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">N/A</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="text-xs text-slate-600 space-y-1">
                                  <div>Activity: {prediction.factors.activityDrop}/30</div>
                                  <div>Payment: {prediction.factors.paymentIssues}/25</div>
                                  <div>Features: {prediction.factors.featureUsage}/20</div>
                                </div>
                              </td>
                              <td className="p-3">
                                <Link
                                  href={`/users/${prediction.userId}`}
                                  className="text-sm text-cyan-600 hover:text-cyan-700 hover:underline"
                                >
                                  View Details
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          {revenueLoading && revenueForecasts.length === 0 ? (
            <LoadingState />
          ) : revenueError && revenueForecasts.length === 0 ? (
            <ErrorState description={revenueError} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {revenueForecasts.map((forecast) => (
                  <Card key={forecast.period}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600">
                        {forecast.period === '30d' ? '30-Day' : forecast.period === '60d' ? '60-Day' : '90-Day'} Forecast
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(forecast.trend)}
                          <span className="text-2xl font-bold">{formatCurrency(forecast.forecastedMRR)}</span>
                        </div>
                        <p className="text-xs text-slate-500">ARR: {formatCurrency(forecast.forecastedARR)}</p>
                        <div className="text-xs text-slate-600">
                          <div>New Customers: {forecast.factors.newCustomers}</div>
                          <div>Churn Rate: {(forecast.factors.churnRate * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {revenueForecasts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Forecast Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={revenueForecasts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Area
                          type="monotone"
                          dataKey="forecastedMRR"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <div className="flex gap-2 mb-4">
            {(['tokens', 'mindmaps', 'users'] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  selectedMetric === metric
                    ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-white/60 backdrop-blur-sm text-slate-700 hover:bg-white/80'
                }`}
              >
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </button>
            ))}
          </div>

          {usageLoading && usageForecasts.length === 0 ? (
            <LoadingState />
          ) : usageError && usageForecasts.length === 0 ? (
            <ErrorState description={usageError} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {usageForecasts
                  .filter(f => f.metric === selectedMetric)
                  .map((forecast) => (
                    <Card key={forecast.period}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                          {forecast.period === '30d' ? '30-Day' : forecast.period === '60d' ? '60-Day' : '90-Day'} Forecast
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getTrendIcon(forecast.trend)}
                            <span className="text-2xl font-bold">{formatNumber(forecast.forecastedValue)}</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Growth: {(forecast.growthRate * 100).toFixed(1)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {usageForecasts.filter(f => f.metric === selectedMetric).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Forecast Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={usageForecasts.filter(f => f.metric === selectedMetric)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatNumber(value)} />
                        <Area
                          type="monotone"
                          dataKey="forecastedValue"
                          stroke="#06b6d4"
                          fill="#06b6d4"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

