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
import { Sparkles, X, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

interface AICoachProps {
  pageContext: {
    pageName: string
    metrics?: Record<string, any>
    data?: any
    description?: string
  }
  className?: string
}

export function AICoach({ pageContext, className = "" }: AICoachProps) {
  const [explanation, setExplanation] = useState<string | null>(null)
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

      const data = await response.json()
      setExplanation(data.explanation || 'Unable to generate explanation.')
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

  // Format explanation text for better readability
  const formatExplanation = (text: string) => {
    // Split by numbered points or bullet points
    const lines = text.split(/\n+/)
    return lines.map((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed) return null
      
      // Check for numbered lists (1., 2., etc.)
      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <div key={idx} className="flex gap-3 mb-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
              {trimmed.match(/^\d+/)?.[0]}
            </span>
            <p className="flex-1 text-gray-700 leading-relaxed">{trimmed.replace(/^\d+\.\s/, '')}</p>
          </div>
        )
      }
      
      // Check for bullet points (-, •, etc.)
      if (/^[-•]\s/.test(trimmed)) {
        return (
          <div key={idx} className="flex gap-3 mb-2">
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
            <p className="flex-1 text-gray-700 leading-relaxed">{trimmed.replace(/^[-•]\s/, '')}</p>
          </div>
        )
      }
      
      // Regular paragraph
      if (trimmed.length > 0) {
        return (
          <p key={idx} className="mb-3 text-gray-700 leading-relaxed last:mb-0">
            {trimmed}
          </p>
        )
      }
      
      return null
    }).filter(Boolean)
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
            {isLoading && !explanation && (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-600">Analyzing page content...</p>
              </div>
            )}

            {error && !explanation && (
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

            {explanation && (
              <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                <div className="prose prose-sm max-w-none">
                  {formatExplanation(explanation)}
                </div>
              </div>
            )}

            {isLoading && explanation && (
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

