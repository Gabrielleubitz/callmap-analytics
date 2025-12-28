"use client"

/**
 * Analytics Chat / AI Copilot
 * 
 * Natural language queries for analytics data with full database access
 */

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { Bot, Send, User, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Lightbulb } from "lucide-react"

interface Message {
  role: 'user' | 'assistant'
  content?: string
  timestamp: Date
  copilotResponse?: CopilotResponse
}

interface CopilotResponse {
  answer: string
  keyMetrics: Array<{ label: string; value: string | number; trend?: string | null }>
  recommendations: Array<{
    title: string
    severity: 'low' | 'medium' | 'high'
    description: string
    impact?: string
    suggestedActions?: string[]
  }>
  contributingAgents: Array<{ id: string; label: string }>
}

const AGENT_COLORS: Record<string, string> = {
  marketing: 'bg-purple-100 text-purple-700 border-purple-300',
  support: 'bg-blue-100 text-blue-700 border-blue-300',
  product: 'bg-green-100 text-green-700 border-green-300',
  revenue: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  ops: 'bg-orange-100 text-orange-700 border-orange-300',
}

export default function AnalyticsChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    const question = input
    setInput("")
    setIsLoading(true)

    try {
      // Use the intelligent copilot endpoint
      const response = await fetch('/api/analytics/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get AI response')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        copilotResponse: data,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('[Analytics Chat] Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const getTrendIcon = (trend?: string | null) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-600" />
    return <Minus className="h-3 w-3 text-gray-400" />
  }

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    const styles = {
      high: 'bg-red-100 text-red-700 border-red-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300',
    }
    return (
      <Badge variant="outline" className={`text-xs ${styles[severity]}`}>
        {severity}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics AI Copilot</h1>
        <p className="text-gray-600 text-sm">
          Ask any question about your analytics data. I have access to the entire database and can provide insights from Marketing, Support, Product, Revenue, and Operations perspectives.
        </p>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Start a conversation by asking a question about your analytics data.</p>
              <p className="text-sm mt-2">Example: &quot;Show me users who churned last month&quot;</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white p-3'
                    : 'bg-white border border-gray-200 p-0'
                }`}
              >
                {message.role === 'user' ? (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </>
                ) : message.copilotResponse ? (
                  <div className="p-4 space-y-4">
                    {/* Contributing Agents */}
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Answered by:</span>
                      <div className="flex flex-wrap gap-2">
                        {message.copilotResponse.contributingAgents.map((agent) => (
                          <Badge
                            key={agent.id}
                            variant="outline"
                            className={`text-xs font-semibold ${
                              AGENT_COLORS[agent.id] || 'bg-gray-100 text-gray-700 border-gray-300'
                            }`}
                          >
                            {agent.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Main Answer */}
                    <div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {message.copilotResponse.answer}
                      </p>
                    </div>

                    {/* Key Metrics */}
                    {message.copilotResponse.keyMetrics && message.copilotResponse.keyMetrics.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                          Key Metrics
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {message.copilotResponse.keyMetrics.map((metric, metricIdx) => (
                            <div
                              key={metricIdx}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                            >
                              <span className="text-gray-600">{metric.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">
                                  {typeof metric.value === 'number'
                                    ? metric.value.toLocaleString()
                                    : metric.value}
                                </span>
                                {getTrendIcon(metric.trend)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {message.copilotResponse.recommendations && message.copilotResponse.recommendations.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-3 w-3 text-yellow-600" />
                          <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Recommendations
                          </h5>
                        </div>
                        <div className="space-y-2">
                          {message.copilotResponse.recommendations.map((rec, recIdx) => (
                            <div
                              key={recIdx}
                              className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                            >
                              <div className="flex items-start justify-between mb-1">
                                <h6 className="font-semibold text-sm text-gray-900">
                                  {rec.title}
                                </h6>
                                {getSeverityBadge(rec.severity)}
                              </div>
                              <p className="text-xs text-gray-700 mb-1">{rec.description}</p>
                              {rec.impact && (
                                <p className="text-xs text-gray-600 italic mb-2">
                                  Impact: {rec.impact}
                                </p>
                              )}
                              {rec.suggestedActions && rec.suggestedActions.length > 0 && (
                                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1 mt-2">
                                  {rec.suggestedActions.map((action, actionIdx) => (
                                    <li key={actionIdx}>{action}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap p-3">{message.content}</p>
                    <p className="text-xs px-3 pb-3 text-gray-400">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </>
                )}
              </div>
              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-sm text-gray-600">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question about your analytics..."
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

