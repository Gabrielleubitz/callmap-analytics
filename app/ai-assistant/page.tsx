"use client"

/**
 * Consolidated AI Assistant Page
 * 
 * Combines AI Agents and AI Copilot into a single unified interface
 */

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Bot, Send, Copy, Check, Sparkles, Zap, Shield, Lightbulb, Users, DollarSign, Activity, TrendingUp, TrendingDown, Minus, User } from "lucide-react"
import { AICoach } from "@/components/ai/ai-coach"

type AgentId = 'marketing' | 'support' | 'product' | 'revenue' | 'ops'
type Tone = 'normal' | 'brutal'

const ALL_AGENTS: Array<{ id: AgentId; label: string; description: string; icon: any }> = [
  { id: 'marketing', label: 'Marketing', description: 'Growth, acquisition, activation, retention', icon: Zap },
  { id: 'support', label: 'Support', description: 'Reliability, errors, customer pain', icon: Shield },
  { id: 'product', label: 'Product', description: 'Feature usage, stickiness, UX', icon: Lightbulb },
  { id: 'revenue', label: 'Revenue', description: 'Plans, MRR, monetization', icon: DollarSign },
  { id: 'ops', label: 'Ops', description: 'Throughput, costs, operational health', icon: Activity },
]

const AGENT_COLORS: Record<string, string> = {
  marketing: 'bg-purple-100 text-purple-700 border-purple-300',
  support: 'bg-blue-100 text-blue-700 border-blue-300',
  product: 'bg-green-100 text-green-700 border-green-300',
  revenue: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  ops: 'bg-orange-100 text-orange-700 border-orange-300',
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content?: string
  timestamp: Date
  agentType?: 'product' | 'dev'
  agents?: AgentId[]
  tone?: Tone
  copilotResponse?: {
    answer: string
    keyMetrics?: Array<{ label: string; value: string | number; trend?: string | null }>
    recommendations?: Array<{
      title: string
      severity: 'low' | 'medium' | 'high'
      description: string
    }>
    contributingAgents?: Array<{ id: string; label: string }>
  }
}

function AIAssistantContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<"agents" | "copilot">("agents")
  
  // Agents state
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>(['product', 'revenue'])
  const [tone, setTone] = useState<Tone>('normal')
  const [agentInput, setAgentInput] = useState("")
  const [agentMessages, setAgentMessages] = useState<Message[]>([])
  const [agentLoading, setAgentLoading] = useState(false)
  
  // Copilot state
  const [copilotInput, setCopilotInput] = useState("")
  const [copilotMessages, setCopilotMessages] = useState<Message[]>([])
  const [copilotLoading, setCopilotLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      if (activeTab === "agents") setAgentInput(q)
      else setCopilotInput(q)
    }
  }, [searchParams, activeTab])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agentMessages, copilotMessages])

  const handleAgentSend = async () => {
    if (!agentInput.trim() || agentLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: agentInput,
      timestamp: new Date(),
      agents: selectedAgents,
      tone,
    }

    setAgentMessages(prev => [...prev, userMessage])
    const question = agentInput
    setAgentInput("")
    setAgentLoading(true)

    try {
      const response = await fetch('/api/admin/ai-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          agents: selectedAgents,
          mode: 'multi',
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.answer,
        timestamp: new Date(),
        agents: selectedAgents,
      }

      setAgentMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setAgentMessages(prev => [...prev, errorMessage])
    } finally {
      setAgentLoading(false)
    }
  }

  const handleCopilotSend = async () => {
    if (!copilotInput.trim() || copilotLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: copilotInput,
      timestamp: new Date(),
    }

    setCopilotMessages(prev => [...prev, userMessage])
    const question = copilotInput
    setCopilotInput("")
    setCopilotLoading(true)

    try {
      const response = await fetch('/api/analytics/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        copilotResponse: data,
        timestamp: new Date(),
      }

      setCopilotMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setCopilotMessages(prev => [...prev, errorMessage])
    } finally {
      setCopilotLoading(false)
    }
  }

  const toggleAgent = (agentId: AgentId) => {
    setSelectedAgents(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    )
  }

  const getTrendIcon = (trend?: string | null) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-600" />
    return <Minus className="h-3 w-3 text-slate-400" />
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <AICoach
          pageContext={{
            pageName: "AI Assistant",
            description: "AI-powered agents and analytics copilot",
          }}
        />
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold gradient-text mb-2">AI Assistant</h1>
        <p className="text-slate-600 text-sm">
          Get AI-powered insights from specialized agents or ask questions about your analytics data
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "agents" | "copilot")} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Agents
          </TabsTrigger>
          <TabsTrigger value="copilot" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Analytics Copilot
          </TabsTrigger>
        </TabsList>

        {/* AI Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_AGENTS.map((agent) => {
                  const Icon = agent.icon
                  const isSelected = selectedAgents.includes(agent.id)
                  return (
                    <Button
                      key={agent.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-2 ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white'
                          : ''
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {agent.label}
                      {isSelected && <Check className="h-3 w-3" />}
                    </Button>
                  )
                })}
              </div>
              <div className="flex gap-2 mb-4">
                <Button
                  variant={tone === 'normal' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTone('normal')}
                  className={tone === 'normal' ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white' : ''}
                >
                  Normal Tone
                </Button>
                <Button
                  variant={tone === 'brutal' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTone('brutal')}
                  className={tone === 'brutal' ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white' : ''}
                >
                  Brutal Tone
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-[600px] flex flex-col">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {agentMessages.length === 0 && (
                <div className="text-center text-slate-500 py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p>Start a conversation with your selected agents</p>
                </div>
              )}
              {agentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-cyan-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white p-3'
                        : 'bg-white/60 backdrop-blur-sm border border-white/30 p-3'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.agents && message.agents.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {message.agents.map((agentId) => {
                          const agent = ALL_AGENTS.find(a => a.id === agentId)
                          if (!agent) return null
                          const Icon = agent.icon
                          return (
                            <Badge key={agentId} variant="outline" className="text-xs">
                              <Icon className="h-3 w-3 mr-1" />
                              {agent.label}
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                    <p className="text-xs mt-2 opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
              {agentLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-cyan-600" />
                  </div>
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3">
                    <p className="text-sm text-slate-600">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="border-t border-white/20 p-4">
              <div className="flex gap-2">
                <Input
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAgentSend()}
                  placeholder="Ask your agents a question..."
                  className="flex-1"
                />
                <Button onClick={handleAgentSend} disabled={agentLoading || !agentInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Copilot Tab */}
        <TabsContent value="copilot" className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {copilotMessages.length === 0 && (
                <div className="text-center text-slate-500 py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p>Ask any question about your analytics data</p>
                  <p className="text-sm mt-2">Example: &quot;Show me users who churned last month&quot;</p>
                </div>
              )}
              {copilotMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-cyan-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white p-3'
                        : 'bg-white/60 backdrop-blur-sm border border-white/30 p-0'
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
                        {message.copilotResponse.contributingAgents && (
                          <div className="flex items-center gap-2 pb-3 border-b border-white/20">
                            <span className="text-xs text-slate-500">Answered by:</span>
                            <div className="flex flex-wrap gap-2">
                              {message.copilotResponse.contributingAgents.map((agent) => (
                                <Badge
                                  key={agent.id}
                                  variant="outline"
                                  className={`text-xs ${AGENT_COLORS[agent.id] || 'bg-slate-100 text-slate-700'}`}
                                >
                                  {agent.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {message.copilotResponse.answer}
                        </p>
                        {message.copilotResponse.keyMetrics && message.copilotResponse.keyMetrics.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-slate-600 mb-2">Key Metrics</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {message.copilotResponse.keyMetrics.map((metric, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-white/40 backdrop-blur-sm rounded text-sm"
                                >
                                  <span className="text-slate-600">{metric.label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900">
                                      {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                                    </span>
                                    {getTrendIcon(metric.trend)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-white/20">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap p-3">{message.content}</p>
                        <p className="text-xs px-3 pb-3 text-slate-400">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
              {copilotLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-cyan-600" />
                  </div>
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3">
                    <p className="text-sm text-slate-600">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="border-t border-white/20 p-4">
              <div className="flex gap-2">
                <Input
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCopilotSend()}
                  placeholder="Ask a question about your analytics..."
                  className="flex-1"
                />
                <Button onClick={handleCopilotSend} disabled={copilotLoading || !copilotInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AIAssistantPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AIAssistantContent />
    </Suspense>
  )
}

