"use client"

/**
 * AI Coach Component
 * 
 * Provides AI-powered explanations of what the user is looking at on any page
 * Automatically loads and displays explanations on mount
 */

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Lightbulb, Eye } from "lucide-react"
import Link from "next/link"

interface AICoachProps {
  pageContext: {
    pageName: string
    metrics?: Record<string, any>
    data?: any
    description?: string
  }
  className?: string
}

interface CoachData {
  overview: string
  keyTakeaways: string[]
  suggestedAgents: string[]
  suggestedPrompt: string
}

const AGENT_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  support: 'Support',
  product: 'Product',
  revenue: 'Revenue',
  ops: 'Ops',
}

export function AICoach({ pageContext, className = "" }: AICoachProps) {
  const [data, setData] = useState<CoachData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchExplanation = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/ai/explain-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: pageContext.pageName,
          description: pageContext.description,
          metrics: pageContext.metrics,
          data: pageContext.data,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get AI explanation')
      }

      const responseData = await response.json()
      setData({
        overview: responseData.overview || 'Unable to generate overview.',
        keyTakeaways: responseData.keyTakeaways || [],
        suggestedAgents: responseData.suggestedAgents || ['ops'],
        suggestedPrompt: responseData.suggestedPrompt || `Tell me more about the ${pageContext.pageName} data.`,
      })
      setHasLoaded(true)
    } catch (err: any) {
      console.error('[AI Coach] Error:', err)
      setError(err.message || 'Failed to load explanation')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load explanation on mount
  useEffect(() => {
    if (!hasLoaded) {
      fetchExplanation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build URL for AI agents page with pre-filled data
  const getAgentsUrl = () => {
    if (!data) return '/admin/ai-agents'
    const params = new URLSearchParams()
    params.set('q', data.suggestedPrompt)
    params.set('agents', data.suggestedAgents.join(','))
    return `/admin/ai-agents?${params.toString()}`
  }

  return (
    <Card className={`border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm ${className}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">AI Page Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">Automated insights about this page</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasLoaded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchExplanation}
                disabled={isLoading}
                className="h-8 w-8 p-0"
                title="Refresh explanation"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 pt-2 border-t border-blue-200">
            {isLoading && !data && (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-600">Analyzing page content...</p>
              </div>
            )}

            {error && !data && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 mb-3">{error}</p>
                <Button
                  onClick={fetchExplanation}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {data && (
              <div className="space-y-4">
                {/* What you're looking at */}
                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <h4 className="font-semibold text-sm text-gray-900">What you&apos;re looking at</h4>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{data.overview}</p>
                </div>

                {/* Key Takeaways */}
                {data.keyTakeaways.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-4 w-4 text-yellow-600" />
                      <h4 className="font-semibold text-sm text-gray-900">Key Takeaways</h4>
                    </div>
                    <ul className="space-y-2">
                      {data.keyTakeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-semibold mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="flex-1 text-sm text-gray-700 leading-relaxed">{takeaway}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Consult AI Agents */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-900 mb-1">Want to dive deeper?</h4>
                      <p className="text-xs text-gray-600">
                        Consult our AI agents for more detailed analysis
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {data.suggestedAgents.map((agentId) => (
                      <Badge
                        key={agentId}
                        variant="outline"
                        className="bg-white border-blue-300 text-blue-700 text-xs"
                      >
                        {AGENT_LABELS[agentId] || agentId}
                      </Badge>
                    ))}
                  </div>
                  <Link href={getAgentsUrl()}>
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Ask AI Agents
                      <ArrowRight className="h-3 w-3 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {isLoading && data && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

