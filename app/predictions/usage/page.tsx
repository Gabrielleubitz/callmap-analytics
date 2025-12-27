"use client"

/**
 * Usage Forecasting Page
 * 
 * Predicts token usage, mindmap creation, and user growth
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatNumber } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, Zap, FileText, Users } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"

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

export default function UsageForecastPage() {
  const [forecasts, setForecasts] = useState<UsageForecast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<'tokens' | 'mindmaps' | 'users'>('tokens')

  useEffect(() => {
    const fetchForecasts = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const periods: ('30d' | '60d' | '90d')[] = ['30d', '60d', '90d']
        const results = await Promise.all(
          periods.map(period =>
            fetch(`/api/analytics/predictions/usage?metric=${selectedMetric}&period=${period}`).then(r => r.json())
          )
        )
        setForecasts(results.map(r => r.data))
      } catch (err: any) {
        console.error('[Usage Forecast] Error:', err)
        setError(err.message || 'Failed to load forecasts')
      } finally {
        setIsLoading(false)
      }
    }

    fetchForecasts()
  }, [selectedMetric])

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'tokens':
        return <Zap className="h-5 w-5 text-yellow-500" />
      case 'mindmaps':
        return <FileText className="h-5 w-5 text-purple-500" />
      case 'users':
        return <Users className="h-5 w-5 text-blue-500" />
      default:
        return null
    }
  }

  if (isLoading && forecasts.length === 0) {
    return <LoadingState />
  }

  if (error && forecasts.length === 0) {
    return <ErrorState description={error} />
  }

  // Prepare chart data
  const chartData = forecasts.map(f => ({
    period: f.period,
    value: f.forecastedValue,
    lower: f.confidenceInterval.lower,
    upper: f.confidenceInterval.upper,
  }))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Usage Forecasting</h1>
          <p className="text-gray-600 text-sm">
            Predicts token usage, mindmap creation, and user growth
          </p>
        </div>
        <div>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as 'tokens' | 'mindmaps' | 'users')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="tokens">Tokens</option>
            <option value="mindmaps">Mindmaps</option>
            <option value="users">Users</option>
          </select>
        </div>
      </div>

      {/* Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {forecasts.map((forecast) => (
          <Card key={forecast.period}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                {getMetricIcon(selectedMetric)}
                {forecast.period === '30d' ? '30-Day' : forecast.period === '60d' ? '60-Day' : '90-Day'} Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Forecasted Value</div>
                  <span className="text-2xl font-bold">{formatNumber(forecast.forecastedValue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(forecast.trend)}
                  <span className="text-sm text-gray-600 capitalize">{forecast.trend}</span>
                  <Badge variant="outline" className="ml-2">
                    {forecast.growthRate > 0 ? '+' : ''}{forecast.growthRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="text-xs text-gray-500">
                  Confidence: {formatNumber(forecast.confidenceInterval.lower)} - {formatNumber(forecast.confidenceInterval.upper)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Forecast Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Forecast Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="#8884d8"
                  fill="#fff"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

