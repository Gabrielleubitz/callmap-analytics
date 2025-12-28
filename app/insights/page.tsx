"use client"

/**
 * Insights Page
 * 
 * Displays AI-powered insights, anomaly detection, and recommendations
 */

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDateTime } from "@/lib/utils"
import { Lightbulb, AlertTriangle, TrendingUp, CheckCircle, RefreshCw } from "lucide-react"
import { AICoach } from "@/components/ai/ai-coach"

interface Insight {
  id: string
  type: 'summary' | 'anomaly' | 'trend' | 'recommendation'
  title: string
  description: string
  severity?: 'info' | 'warning' | 'critical'
  metrics?: Record<string, any>
  timestamp: string
  generated_at: string
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')

  const fetchInsights = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/insights/generate?period=${period}`)
      if (!response.ok) {
        throw new Error('Failed to fetch insights')
      }
      const data = await response.json()
      setInsights(data.data || [])
    } catch (err: any) {
      console.error('[Insights] Error:', err)
      setError(err.message || 'Failed to load insights')
    } finally {
      setIsLoading(false)
    }
  }, [period])

  const generateInsights = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      if (!response.ok) {
        throw new Error('Failed to generate insights')
      }
      const data = await response.json()
      setInsights(data.data || [])
    } catch (err: any) {
      console.error('[Insights] Error generating:', err)
      setError(err.message || 'Failed to generate insights')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'summary':
        return <CheckCircle className="h-5 w-5 text-blue-500" />
      case 'anomaly':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'trend':
        return <TrendingUp className="h-5 w-5 text-purple-500" />
      case 'recommendation':
        return <Lightbulb className="h-5 w-5 text-yellow-500" />
      default:
        return <CheckCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-700">Critical</Badge>
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700">Warning</Badge>
      case 'info':
      default:
        return <Badge variant="outline">Info</Badge>
    }
  }

  const groupedInsights = {
    summary: insights.filter(i => i.type === 'summary'),
    trends: insights.filter(i => i.type === 'trend'),
    anomalies: insights.filter(i => i.type === 'anomaly'),
    recommendations: insights.filter(i => i.type === 'recommendation'),
  }

  if (isLoading && insights.length === 0) {
    return <LoadingState />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Insights & Anomalies</h1>
          <p className="text-gray-600 text-sm">
            AI-powered insights, trend analysis, and anomaly detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'daily' | 'weekly')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <Button
            onClick={generateInsights}
            disabled={isGenerating}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate New'}
          </Button>
        </div>
      </div>

      {error && (
        <ErrorState description={error} onRetry={fetchInsights} />
      )}

      {/* Summary */}
      {groupedInsights.summary.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {groupedInsights.summary.map((insight) => (
              <div key={insight.id} className="flex items-start gap-3">
                {getInsightIcon(insight.type)}
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{insight.title}</h3>
                  <p className="text-sm text-gray-600">{insight.description}</p>
                  {insight.metrics && (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {Object.entries(insight.metrics).map(([key, value]) => (
                        <div key={key}>
                          <div className="text-gray-500 text-xs">{key}</div>
                          <div className="font-semibold">{typeof value === 'number' ? value.toLocaleString() : String(value)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trends */}
      {groupedInsights.trends.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupedInsights.trends.map((insight) => (
                <div key={insight.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{insight.title}</h3>
                      {getSeverityBadge(insight.severity)}
                    </div>
                    <p className="text-sm text-gray-600">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anomalies */}
      {groupedInsights.anomalies.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Anomalies ({groupedInsights.anomalies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groupedInsights.anomalies.map((insight) => (
                <div
                  key={insight.id}
                  className="p-4 border border-red-200 rounded-lg bg-red-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getInsightIcon(insight.type)}
                    <h3 className="font-medium text-gray-900">{insight.title}</h3>
                    {getSeverityBadge(insight.severity)}
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                  {insight.metrics && (
                    <div className="text-xs text-gray-600">
                      Current: {insight.metrics.current?.toFixed(2)} | 
                      Expected: {insight.metrics.expected?.toFixed(2)} | 
                      Deviation: {insight.metrics.deviation?.toFixed(1)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {groupedInsights.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations ({groupedInsights.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groupedInsights.recommendations.map((insight) => (
                <div
                  key={insight.id}
                  className="p-4 border border-yellow-200 rounded-lg bg-yellow-50"
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">{insight.title}</h3>
                      <p className="text-sm text-gray-700">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {insights.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No insights available</p>
            <Button onClick={generateInsights} disabled={isGenerating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate Insights
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

