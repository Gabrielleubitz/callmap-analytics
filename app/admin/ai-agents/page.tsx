"use client"

/**
 * AI Agents Page
 * 
 * Supports two modes:
 * 1. Single agent mode: Product/Dev with tone control (Normal/Brutal)
 * 2. Multi-agent mode: All agents (marketing, support, product, revenue, ops) with @mention tagging
 */

import { useState, useRef, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Bot, Send, Copy, Check, Sparkles, HelpCircle, Zap, Shield, TrendingDown, AlertTriangle, Lightbulb, Users, DollarSign, Activity } from "lucide-react"

type AgentType = 'product' | 'dev'
type AgentId = 'marketing' | 'support' | 'product' | 'revenue' | 'ops'
type Tone = 'normal' | 'brutal'
type Mode = 'single' | 'multi'

const ALL_AGENTS: Array<{ id: AgentId; label: string; description: string; icon: any }> = [
  { id: 'marketing', label: 'Marketing', description: 'Growth, acquisition, activation, retention', icon: Zap },
  { id: 'support', label: 'Support', description: 'Reliability, errors, customer pain', icon: Shield },
  { id: 'product', label: 'Product', description: 'Feature usage, stickiness, UX', icon: Lightbulb },
  { id: 'revenue', label: 'Revenue', description: 'Plans, MRR, monetization', icon: DollarSign },
  { id: 'ops', label: 'Ops', description: 'Throughput, costs, operational health', icon: Activity },
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentType?: AgentType
  agents?: AgentId[]
  tone?: Tone
  tags?: string[]
  showGeneratePrompt?: boolean
  answerText?: string
  agentReports?: Array<{ agentId: string; agentLabel: string; report: any }>
}

function AIAgentsContent() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('single')
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('product')
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>(['product', 'revenue', 'ops'])
  const [tone, setTone] = useState<Tone>('normal')
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [loadingStage, setLoadingStage] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize from URL params
  useEffect(() => {
    const q = searchParams.get('q')
    const agentsParam = searchParams.get('agents')
    
    if (q) {
      setInput(q)
    }
    
    if (agentsParam) {
      const agentIds = agentsParam.split(',').filter((id): id is AgentId => 
        ALL_AGENTS.some(a => a.id === id)
      )
      if (agentIds.length > 0) {
        setMode('multi')
        setSelectedAgents(agentIds)
      }
    }
  }, [searchParams])

  // Parse @mentions from input
  const parsedTaggedAgents = useMemo(() => {
    const matches = Array.from(input.matchAll(/@([a-zA-Z]+)/g))
    const tags = matches.map((m) => m[1].toLowerCase())
    return ALL_AGENTS.filter((agent) => tags.includes(agent.id)).map((a) => a.id) as AgentId[]
  }, [input])

  // Effective agents: use @mentions if present, otherwise use selected agents
  const effectiveAgents: AgentId[] = parsedTaggedAgents.length > 0 ? parsedTaggedAgents : selectedAgents

  // Quick Actions - prefill prompts
  const quickActions = [
    {
      id: 'product-risks',
      label: 'Top 3 Product Risks',
      description: 'Identify biggest UX and feature risks',
      agent: 'product' as AgentType,
      prompt: 'What are the top 3 product risks I should address immediately? Be specific about features, UX issues, or user experience problems.',
      icon: AlertTriangle,
    },
    {
      id: 'security-risks',
      label: 'Top 3 Security Risks',
      description: 'Find security gaps and vulnerabilities',
      agent: 'dev' as AgentType,
      prompt: 'What are the top 3 security risks in our codebase? Focus on auth, RBAC, API security, and data access patterns.',
      icon: Shield,
    },
    {
      id: 'kill-or-fix',
      label: 'Kill or Fix Feature',
      description: 'Which feature to prioritize or remove',
      agent: 'product' as AgentType,
      prompt: 'Based on usage data, which feature should we kill or fix first? Give me a clear recommendation with reasoning.',
      icon: TrendingDown,
    },
    {
      id: 'usage-drop',
      label: 'Biggest Usage Drop',
      description: 'Find where usage declined most',
      agent: 'product' as AgentType,
      prompt: 'Show me the biggest usage drop in the last 30 days. What feature or area lost the most engagement?',
      icon: TrendingDown,
    },
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleAgent = (agentId: AgentId) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId]
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      agentType: mode === 'single' ? selectedAgent : undefined,
      agents: mode === 'multi' ? effectiveAgents : undefined,
      tone: mode === 'single' ? tone : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    const question = input
    setInput("")
    setIsLoading(true)
    setError(null)
    setLoadingStage('Analyzing question and selecting approach...')

    try {
      let response
      if (mode === 'single') {
        // Single agent mode (Product/Dev with tone)
        response = await fetch('/api/admin/ai-agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: question,
            agentType: selectedAgent,
            tone,
          }),
        })
      } else {
        // Multi-agent mode
        response = await fetch('/api/admin/ai-agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: question,
            agents: effectiveAgents.length > 0 ? effectiveAgents : selectedAgents,
          }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get AI response')
      }

      setLoadingStage('Generating response...')
      const data = await response.json()
      setLoadingStage('')

      if (mode === 'single' && data.agent) {
        // Single agent response
        const agent = data.agent
        const metadata = data.metadata || {}
        const answerText = agent.report?.summary || JSON.stringify(agent.report || {})

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answerText,
          timestamp: new Date(),
          agentType: selectedAgent,
          tone,
          tags: metadata.suggestedTags || [],
          showGeneratePrompt: metadata.showGeneratePrompt || false,
          answerText,
        }

        setMessages(prev => [...prev, assistantMessage])
      } else if (data.agents && Array.isArray(data.agents)) {
        // Multi-agent response
        const agentReports = data.agents.map((agent: any) => ({
          agentId: agent.agentId || agent.agent_id,
          agentLabel: agent.agentLabel || agent.agent_label || ALL_AGENTS.find(a => a.id === agent.agentId)?.label || 'Unknown',
          report: agent.report || {},
        }))

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: '', // Will be displayed per agent
          timestamp: new Date(),
          agents: effectiveAgents,
          agentReports,
        }

        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err: any) {
      console.error('[AI Agents] Error:', err)
      setError(err.message || 'Failed to get response')
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setLoadingStage('')
    }
  }

  const handleQuickAction = async (action: typeof quickActions[0]) => {
    setSelectedAgent(action.agent)
    setInput(action.prompt)
    
    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: action.prompt,
      timestamp: new Date(),
      agentType: action.agent,
      tone,
    }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)
    setLoadingStage('Analyzing question and selecting approach...')

    try {
      const response = await fetch('/api/admin/ai-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: action.prompt,
          agentType: action.agent,
          tone,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get AI response')
      }

      setLoadingStage('Generating response...')
      const data = await response.json()
      const agent = data.agent
      const metadata = data.metadata || {}

      const answerText = agent.report?.summary || JSON.stringify(agent.report || {})

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answerText,
        timestamp: new Date(),
        agentType: action.agent,
        tone,
        tags: metadata.suggestedTags || [],
        showGeneratePrompt: metadata.showGeneratePrompt || false,
        answerText,
      }

      setMessages(prev => [...prev, assistantMessage])
      setLoadingStage('')
    } catch (err: any) {
      console.error('[AI Agents] Error:', err)
      setError(err.message || 'Failed to get response')
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setLoadingStage('')
    }
  }

  const handleGeneratePrompt = async (message: Message) => {
    if (!message.answerText || !message.agentType) return

    try {
      const response = await fetch('/api/admin/ai-agents/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: message.agentType,
          question: messages.find(m => m.role === 'user' && m.id < message.id)?.content || '',
          answer: message.answerText,
          tags: message.tags || [],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate prompt')
      }

      const data = await response.json()
      const prompt = data.prompt

      // Copy to clipboard
      await navigator.clipboard.writeText(prompt)
      setCopiedPromptId(message.id)
      setTimeout(() => setCopiedPromptId(null), 2000)
    } catch (err: any) {
      console.error('[Generate Prompt] Error:', err)
      alert('Failed to generate prompt: ' + err.message)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Agents</h1>
        <p className="text-gray-600 text-sm">
          Get direct feedback on product, design, and dev decisions. No fluff.
        </p>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2 text-left hover:bg-blue-50 hover:border-blue-300"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-sm">{action.label}</span>
                  </div>
                  <span className="text-xs text-gray-600">{action.description}</span>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mode Toggle */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-gray-700">Mode:</label>
            <div className="flex gap-2">
              <Button
                variant={mode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('single')}
                className={mode === 'single' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                Single Agent
              </Button>
              <Button
                variant={mode === 'multi' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('multi')}
                className={mode === 'multi' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                Multi-Agent
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {mode === 'single' ? 'Product/Dev with tone control' : 'Tag multiple agents with @mentions'}
            </p>
          </div>

          {mode === 'single' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Single Agent Selector */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-sm font-medium text-gray-700">Agent</label>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                      <strong>Product:</strong> UX, features, roadmap, user experience
                      <br />
                      <strong>Dev:</strong> Security, architecture, performance, code quality
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <Button
                    variant={selectedAgent === 'product' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgent('product')}
                    className={`flex-1 ${selectedAgent === 'product' ? 'bg-blue-600 hover:bg-blue-700 border-blue-600' : ''}`}
                  >
                    Product
                  </Button>
                  <Button
                    variant={selectedAgent === 'dev' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgent('dev')}
                    className={`flex-1 ${selectedAgent === 'dev' ? 'bg-blue-600 hover:bg-blue-700 border-blue-600' : ''}`}
                  >
                    Dev
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedAgent === 'product'
                    ? 'UX, features, roadmap, user experience'
                    : 'Security, architecture, performance, code quality'}
                </p>
              </div>

              {/* Tone Toggle */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-sm font-medium text-gray-700">Tone</label>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                      <strong>Normal:</strong> Professional, direct feedback
                      <br />
                      <strong>Brutal:</strong> No sugarcoating, harsh but constructive
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <Button
                    variant={tone === 'normal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTone('normal')}
                    className={`flex-1 ${tone === 'normal' ? 'bg-blue-600 hover:bg-blue-700 border-blue-600' : ''}`}
                  >
                    Normal
                  </Button>
                  <Button
                    variant={tone === 'brutal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTone('brutal')}
                    className={`flex-1 ${tone === 'brutal' ? 'bg-blue-600 hover:bg-blue-700 border-blue-600' : ''}`}
                  >
                    Brutal
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tone === 'normal'
                    ? 'Professional, direct feedback'
                    : 'No sugarcoating, harsh but constructive'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm font-medium text-gray-700">Select Agents</label>
                <div className="group relative">
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                    Click agents to select them, or use @mentions in your message (e.g., @marketing @support)
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {ALL_AGENTS.map((agent) => {
                  const Icon = agent.icon
                  const isSelected = selectedAgents.includes(agent.id)
                  const isTagged = parsedTaggedAgents.includes(agent.id)
                  return (
                    <Button
                      key={agent.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-2 ${
                        isSelected
                          ? 'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white'
                          : isTagged
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
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
              <p className="text-xs text-gray-500 mt-1">
                {parsedTaggedAgents.length > 0
                  ? `Using @mentions: ${parsedTaggedAgents.map((id) => ALL_AGENTS.find((a) => a.id === id)?.label).join(', ')}`
                  : `Selected: ${selectedAgents.map((id) => ALL_AGENTS.find((a) => a.id === id)?.label).join(', ') || 'None'}`}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tip: Type @agentname in your message to tag specific agents (e.g., @marketing @support)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <ErrorState
          description={error}
          variant="banner"
          className="mb-4"
          onRetry={() => setError(null)}
        />
      )}

      {/* Chat Window */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Ask a question to get started.</p>
              <p className="text-sm mt-2">
                Examples:
              </p>
              <ul className="text-sm mt-2 space-y-1 text-left max-w-md mx-auto">
                <li>• &quot;What do you think about the colors on the analytics page?&quot;</li>
                <li>• &quot;How can we improve the teams page UX?&quot;</li>
                <li>• &quot;Where are security gaps in our API routes?&quot;</li>
              </ul>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex gap-3 mb-6 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-4 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                {/* Agent and Tone Badge for Assistant */}
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    {message.agentType && (
                      <>
                        <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                          {message.agentType === 'product' ? 'Product' : 'Dev'} Agent
                        </Badge>
                        {message.tone === 'brutal' && (
                          <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
                            Brutal
                          </Badge>
                        )}
                      </>
                    )}
                    {message.agents && message.agents.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {message.agents.map((agentId) => {
                          const agent = ALL_AGENTS.find((a) => a.id === agentId)
                          return agent ? (
                            <Badge
                              key={agentId}
                              variant="outline"
                              className="text-xs bg-blue-50 border-blue-200 text-blue-700"
                            >
                              {agent.label}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}
                    {message.tags && message.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-auto">
                        {message.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs bg-gray-50">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1">
                  {message.agentReports && message.agentReports.length > 0 ? (
                    <div className="space-y-4">
                      {message.agentReports.map((agentReport, idx) => (
                        <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                              {agentReport.agentLabel}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {agentReport.report?.summary || JSON.stringify(agentReport.report || {}, null, 2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      message.role === 'user' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {message.content}
                    </p>
                  )}
                </div>

                {/* Generate Prompt Button */}
                {message.role === 'assistant' && message.showGeneratePrompt && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="group relative inline-block w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGeneratePrompt(message)}
                        className="w-full"
                      >
                        {copiedPromptId === message.id ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied to Clipboard!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Generate Prompt
                          </>
                        )}
                      </Button>
                      <div className="invisible group-hover:visible absolute left-0 top-full mt-1 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                        Generates a detailed Cursor prompt you can paste directly into Cursor to implement this recommendation.
                      </div>
                    </div>
                  </div>
                )}

                <p className={`text-xs mt-3 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-xs font-medium text-gray-600">You</span>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start mb-6">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <div className="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
                  <p className="text-sm font-medium text-gray-900">
                    {loadingStage || 'Processing your question...'}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {mode === 'single'
                    ? selectedAgent === 'product'
                      ? 'Analyzing UX, features, and user experience...'
                      : 'Reviewing security, architecture, and code quality...'
                    : `Consulting ${effectiveAgents.length} agent${effectiveAgents.length > 1 ? 's' : ''}...`}
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={mode === 'multi' ? "Ask a question or use @mentions (e.g., @marketing @support)..." : "Ask a question..."}
              disabled={isLoading}
              className="flex-1"
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

export default function AIAgentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AIAgentsContent />
    </Suspense>
  )
}
