"use client"

/**
 * User Health Dashboard
 * 
 * Shows health scores for all users, identifies at-risk users,
 * and provides intervention recommendations
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"
import { Heart, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react"
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

interface UserHealthScore {
  userId: string
  score: number
  factors: {
    activity: number
    engagement: number
    featureUsage: number
    sentiment: number
    payment: number
  }
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  lastCalculated: string
  trends: {
    scoreChange: number
    trend: 'improving' | 'stable' | 'declining'
  }
  recommendations: string[]
}

export default function UserHealthPage() {
  const [healthScores, setHealthScores] = useState<UserHealthScore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'at_risk'>('at_risk')

  const fetchHealthScores = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/analytics/user-health?filter=${filter}&limit=100`)
      if (!response.ok) {
        throw new Error('Failed to fetch health scores')
      }
      const data = await response.json()
      setHealthScores(data.items || [])
    } catch (err: any) {
      console.error('[User Health] Error:', err)
      setError(err.message || 'Failed to load health scores')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-700">Critical</Badge>
      case 'high':
        return <Badge className="bg-orange-100 text-orange-700">High</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
      case 'low':
        return <Badge className="bg-green-100 text-green-700">Low</Badge>
      default:
        return <Badge variant="outline">{riskLevel}</Badge>
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score < 30) return '#ef4444' // red
    if (score < 50) return '#f97316' // orange
    if (score < 70) return '#eab308' // yellow
    return '#22c55e' // green
  }

  // Prepare chart data
  const scoreDistribution = healthScores.reduce((acc, score) => {
    const range = Math.floor(score.score / 10) * 10
    const key = `${range}-${range + 9}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const chartData = Object.entries(scoreDistribution).map(([range, count]) => ({
    range,
    count,
  }))

  if (isLoading && healthScores.length === 0) {
    return <LoadingState />
  }

  if (error && healthScores.length === 0) {
    return <ErrorState description={error} onRetry={fetchHealthScores} />
  }

  const atRiskCount = healthScores.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical').length
  const avgScore = healthScores.length > 0
    ? healthScores.reduce((sum, s) => sum + s.score, 0) / healthScores.length
    : 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Health Dashboard</h1>
          <p className="text-gray-600 text-sm">
            Monitor user health scores and identify at-risk users
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'at_risk')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="at_risk">At Risk Users</option>
            <option value="all">All Users</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Average Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <span className="text-3xl font-bold">{Math.round(avgScore)}</span>
              <span className="text-sm text-gray-500">/ 100</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">At-Risk Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-3xl font-bold">{atRiskCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{healthScores.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution Chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Health Score Distribution</CardTitle>
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
                    <Cell key={`cell-${index}`} fill={getScoreColor(parseInt(entry.range.split('-')[0]))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* User Health Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Health Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {healthScores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-gray-700">User ID</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Health Score</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Risk Level</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Trend</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Factors</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {healthScores.map((score) => (
                    <tr key={score.userId} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <Link
                          href={`/users/${score.userId}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {score.userId.slice(0, 12)}...
                        </Link>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: getScoreColor(score.score) }}
                          />
                          <span className="font-semibold">{score.score}/100</span>
                        </div>
                      </td>
                      <td className="p-3">{getRiskBadge(score.riskLevel)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {getTrendIcon(score.trends.trend)}
                          <span className="text-xs text-gray-600">
                            {score.trends.scoreChange > 0 ? '+' : ''}{score.trends.scoreChange}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>Activity: {score.factors.activity}/25</div>
                          <div>Engagement: {score.factors.engagement}/25</div>
                          <div>Features: {score.factors.featureUsage}/25</div>
                          <div>Sentiment: {score.factors.sentiment}/15</div>
                          <div>Payment: {score.factors.payment}/10</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/users/${score.userId}`}
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

      {/* Recommendations for At-Risk Users */}
      {healthScores.filter(s => s.recommendations.length > 0).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Intervention Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthScores
                .filter(s => s.recommendations.length > 0)
                .slice(0, 10)
                .map((score) => (
                  <div key={score.userId} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        href={`/users/${score.userId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {score.userId.slice(0, 12)}...
                      </Link>
                      <Badge className="bg-orange-100 text-orange-700">
                        Score: {score.score}/100
                      </Badge>
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {score.recommendations.map((rec, idx) => (
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

