"use client"

/**
 * Revenue Forecasting Page
 * 
 * Shows 30/60/90-day revenue forecasts with confidence intervals
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatNumber } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react"
import { AICoach } from "@/components/ai/ai-coach"
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

export default function RevenueForecastPage() {
  const [forecasts, setForecasts] = useState<RevenueForecast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchForecasts = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const periods: ('30d' | '60d' | '90d')[] = ['30d', '60d', '90d']
        const results = await Promise.all(
          periods.map(period =>
            fetch(`/api/analytics/predictions/revenue?period=${period}`).then(r => r.json())
          )
        )
        setForecasts(results.map(r => r.data))
      } catch (err: any) {
        console.error('[Revenue Forecast] Error:', err)
        setError(err.message || 'Failed to load forecasts')
      } finally {
        setIsLoading(false)
      }
    }

    fetchForecasts()
  }, [])

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

  if (isLoading && forecasts.length === 0) {
    return <LoadingState />
  }

  if (error && forecasts.length === 0) {
    return <ErrorState description={error} />
  }

  // Prepare chart data
  const chartData = forecasts.map(f => ({
    period: f.period,
    mrr: f.forecastedMRR,
    lower: f.confidenceInterval.lower,
    upper: f.confidenceInterval.upper,
  }))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue Forecasting</h1>
        <p className="text-gray-600 text-sm">
          30/60/90-day revenue forecasts with confidence intervals
        </p>
      </div>

      {/* Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {forecasts.map((forecast) => (
          <Card key={forecast.period}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {forecast.period === '30d' ? '30-Day' : forecast.period === '60d' ? '60-Day' : '90-Day'} Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Forecasted MRR</div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-2xl font-bold">{formatNumber(forecast.forecastedMRR)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Forecasted ARR</div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-xl font-semibold">{formatNumber(forecast.forecastedARR)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(forecast.trend)}
                  <span className="text-sm text-gray-600 capitalize">{forecast.trend}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Confidence: ${formatNumber(forecast.confidenceInterval.lower)} - ${formatNumber(forecast.confidenceInterval.upper)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Forecast Chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Revenue Forecast Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${formatNumber(value)}`} />
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
                  dataKey="mrr"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Factors */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecasts.map((forecast) => (
              <div key={forecast.period} className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-medium mb-3">
                  {forecast.period === '30d' ? '30-Day' : forecast.period === '60d' ? '60-Day' : '90-Day'} Factors
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">New Customers:</span>
                    <span className="ml-2 font-semibold">{forecast.factors.newCustomers}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Churn Rate:</span>
                    <span className="ml-2 font-semibold">{forecast.factors.churnRate.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Expansion Rate:</span>
                    <span className="ml-2 font-semibold">{forecast.factors.expansionRate.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

