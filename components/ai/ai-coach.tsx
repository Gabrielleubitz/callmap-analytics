"use client"

/**
 * AI Coach Component
 * 
 * Provides AI-powered explanations of what the user is looking at on any page
 */

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, X, Loader2 } from "lucide-react"

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
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setIsExpanded(true)
    } catch (err: any) {
      console.error('[AI Coach] Error:', err)
      setError(err.message || 'Failed to load explanation')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">AI Coach</h3>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          {isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!isExpanded ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Get an AI-powered explanation of what you&apos;re looking at
            </p>
            <Button
              onClick={fetchExplanation}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Explain This Page
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {error ? (
              <div className="text-sm text-red-600">
                {error}
                <Button
                  onClick={fetchExplanation}
                  size="sm"
                  variant="outline"
                  className="ml-2"
                >
                  Retry
                </Button>
              </div>
            ) : explanation ? (
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {explanation}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading explanation...</div>
            )}
            <Button
              onClick={() => {
                setIsExpanded(false)
                setExplanation(null)
              }}
              size="sm"
              variant="ghost"
              className="w-full"
            >
              Collapse
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

