"use client"

/**
 * AI Agents Page - Minimal MVP
 * 
 * Core workflow:
 * 1. Select agent (Product/Dev)
 * 2. Set tone (Normal/Brutal)
 * 3. Ask question
 * 4. Get feedback
 * 5. Generate Cursor prompt if applicable
 */

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Bot, Send, Copy, Check, Sparkles } from "lucide-react"

type AgentType = 'product' | 'dev'
type Tone = 'normal' | 'brutal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentType?: AgentType
  tone?: Tone
  tags?: string[]
  showGeneratePrompt?: boolean
  answerText?: string
}

export default function AIAgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('product')
  const [tone, setTone] = useState<Tone>('normal')
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      agentType: selectedAgent,
      tone,
    }

    setMessages(prev => [...prev, userMessage])
    const question = input
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/ai-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          agentType: selectedAgent,
          tone,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get AI response')
      }

      const data = await response.json()
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

      {/* Agent Selector and Tone Toggle */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            {/* Agent Selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Agent
              </label>
              <div className="flex gap-2">
                <Button
                  variant={selectedAgent === 'product' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAgent('product')}
                >
                  Product
                </Button>
                <Button
                  variant={selectedAgent === 'dev' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAgent('dev')}
                >
                  Dev
                </Button>
              </div>
            </div>

            {/* Tone Toggle */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Tone
              </label>
              <div className="flex gap-2">
                <Button
                  variant={tone === 'normal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTone('normal')}
                >
                  Normal
                </Button>
                <Button
                  variant={tone === 'brutal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTone('brutal')}
                >
                  Brutal
                </Button>
              </div>
            </div>
          </div>
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
                <li>• "What do you think about the colors on the analytics page?"</li>
                <li>• "How can we improve the teams page UX?"</li>
                <li>• "Where are security gaps in our API routes?"</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
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
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    {message.role === 'assistant' && message.tags && message.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {message.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className={`text-sm whitespace-pre-wrap ${
                      message.role === 'user' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {message.content}
                    </p>
                  </div>
                </div>

                {/* Generate Prompt Button */}
                {message.role === 'assistant' && message.showGeneratePrompt && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
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
                  </div>
                )}

                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gray-600">You</span>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">Thinking...</p>
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
              placeholder="Ask a question..."
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
