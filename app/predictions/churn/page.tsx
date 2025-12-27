"use client"

/**
 * Churn Prediction Page
 * 
 * Shows churn risk scores, predicted churn dates, and intervention recommendations
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"
import { AlertTriangle, TrendingDown, Calendar, Lightbulb } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

export default function ChurnPredictionPage() {
  const [predictions, setPredictions] = useState<ChurnPrediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPredictions = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/analytics/predictions/churn?limit=50')
        if (!response.ok) {
          throw new Error('Failed to fetch churn predictions')
        }
        const data = await response.json()
        setPredictions(data.items || [])
      } catch (err: any) {
        console.error('[Churn Prediction] Error:', err)
        setError(err.message || 'Failed to load predictions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPredictions()
  }, [])

  const getRiskBadge = (risk: number) => {
    if (risk >= 80) {
      return <Badge className="bg-red-100 text-red-700">Critical</Badge>
    } else if (risk >= 60) {
      return <Badge className="bg-orange-100 text-orange-700">High</Badge>
    } else if (risk >= 40) {
      return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
    } else {
      return <Badge className="bg-green-100 text-green-700">Low</Badge>
    }
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 80) return '#ef4444'
    if (risk >= 60) return '#f97316'
    if (risk >= 40) return '#eab308'
    return '#22c55e'
  }

  // Prepare chart data
  const riskDistribution = predictions.reduce((acc, p) => {
    const range = Math.floor(p.churnRisk / 20) * 20
    const key = `${range}-${range + 19}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const chartData = Object.entries(riskDistribution).map(([range, count]) => ({
    range,
    count,
  }))

  if (isLoading && predictions.length === 0) {
    return <LoadingState />
  }

  if (error && predictions.length === 0) {
    return <ErrorState description={error} />
  }

  const highRiskCount = predictions.filter(p => p.churnRisk >= 60).length
  const avgRisk = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + p.churnRisk, 0) / predictions.length
    : 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Churn Prediction</h1>
        <p className="text-gray-600 text-sm">
          ML-based churn risk scoring with intervention recommendations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Average Churn Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-3xl font-bold">{Math.round(avgRisk)}</span>
              <span className="text-sm text-gray-500">/ 100</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">High Risk Users</CardTitle>
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
            <CardTitle className="text-sm font-medium text-gray-600">Total Users Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{predictions.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution Chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Churn Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6">
                  {chartData.map((entry, index) => (
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
          {predictions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No predictions available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-gray-700">User ID</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Churn Risk</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Predicted Churn Date</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Risk Factors</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((prediction) => (
                    <tr key={prediction.userId} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <Link
                          href={`/users/${prediction.userId}`}
                          className="text-blue-600 hover:underline text-sm"
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
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDateTime(new Date(prediction.predictedChurnDate))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>Activity Drop: {prediction.factors.activityDrop}/30</div>
                          <div>Payment Issues: {prediction.factors.paymentIssues}/25</div>
                          <div>Feature Usage: {prediction.factors.featureUsage}/20</div>
                          <div>Sentiment: {prediction.factors.sentimentTrend}/15</div>
                          <div>Errors: {prediction.factors.errorFrequency}/10</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/users/${prediction.userId}`}
                          className="text-sm text-blue-600 hover:underline"
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

      {/* Intervention Recommendations */}
      {predictions.filter(p => p.interventionRecommendations.length > 0).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Intervention Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions
                .filter(p => p.interventionRecommendations.length > 0)
                .slice(0, 10)
                .map((prediction) => (
                  <div key={prediction.userId} className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        href={`/users/${prediction.userId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {prediction.userId.slice(0, 12)}...
                      </Link>
                      <Badge className="bg-orange-100 text-orange-700">
                        Risk: {prediction.churnRisk}/100
                      </Badge>
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {prediction.interventionRecommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

