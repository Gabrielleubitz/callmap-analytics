"use client"

import { useCallback, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { cn } from "@/lib/utils"

type AgentId = "marketing" | "support" | "product" | "revenue" | "ops"

type AgentDefinition = {
  id: AgentId
  label: string
  description: string
}

const AGENTS: AgentDefinition[] = [
  {
    id: "marketing",
    label: "Marketing",
    description: "Growth, acquisition, activation, and retention.",
  },
  {
    id: "support",
    label: "Support",
    description: "Reliability issues and customer pain.",
  },
  {
    id: "product",
    label: "Product",
    description: "Feature usage, stickiness, and UX.",
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "Plans, MRR, and monetization.",
  },
  {
    id: "ops",
    label: "Ops",
    description: "Throughput, costs, and operational health.",
  },
]

interface AgentReport {
  agentId: AgentId
  agentLabel: string
  report: {
    summary?: string
    keyMetrics?: { label: string; value: string | number; trend?: string | null }[]
    recommendations?: {
      title: string
      severity: "low" | "medium" | "high"
      description: string
      impact?: string
      suggestedActions?: string[]
    }[]
  } | null
}

interface Round {
  id: string
  createdAt: string
  question: string
  agents: AgentReport[]
}

export default function AIAgentsPage() {
  const [input, setInput] = useState(
    "Give me a cross-functional brief on risks and opportunities for the next 30 days."
  )
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>(() =>
    AGENTS.map((a) => a.id)
  )
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleAgent = (id: AgentId) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const parsedTaggedAgents = useMemo(() => {
    const matches = Array.from(input.matchAll(/@([a-zA-Z]+)/g))
    const tags = matches.map((m) => m[1].toLowerCase())
    const mapped = AGENTS.filter((agent) => tags.includes(agent.id)).map((a) => a.id)
    return mapped as AgentId[]
  }, [input])

  const effectiveAgents: AgentId[] =
    parsedTaggedAgents.length > 0 ? parsedTaggedAgents : selectedAgents

  const runAgents = useCallback(async () => {
    if (!input.trim()) return
    if (effectiveAgents.length === 0) {
      setError("Select at least one agent or @mention agents in your prompt.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const historyPayload = {
        rounds: rounds.map((round) => ({
          question: round.question,
          responses: round.agents.map((agent) => ({
            agentId: agent.agentId,
            summary: agent.report?.summary || "",
          })),
        })),
      }

      const response = await fetch("/api/admin/ai-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          agents: effectiveAgents,
          history: historyPayload,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to run AI agents")
      }

      const data = await response.json()

      const newRound: Round = {
        id: data.generatedAt || String(Date.now()),
        createdAt: data.generatedAt || new Date().toISOString(),
        question: input.trim(),
        agents: (data.agents || []) as AgentReport[],
      }

      setRounds((prev) => [newRound, ...prev])
    } catch (err: any) {
      console.error("[AI Agents] Error:", err)
      setError(err.message || "Failed to run AI agents")
    } finally {
      setIsLoading(false)
    }
  }, [input, effectiveAgents, rounds])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Ops Room</h1>
          <p className="mt-1 text-sm text-gray-600">
            Multi-agent briefing across marketing, support, product, revenue, and ops – all
            grounded in your latest analytics.
          </p>
        </div>
      </div>

      {error && (
        <ErrorState
          title="AI agents failed"
          description={error}
          variant="banner"
          className="mb-4"
          onRetry={() => setError(null)}
        />
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Prompt & Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              What do you want your experts to look at?
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Example: @marketing @revenue Which teams should we prioritize for an upsell this month, and any churn risks we should watch?"
            />
            {parsedTaggedAgents.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Targeting agents: {parsedTaggedAgents.join(", ")}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Agents</span>
              <span className="text-xs text-gray-500">
                Click to toggle agents. You can also @mention them in the prompt.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AGENTS.map((agent) => {
                const active = effectiveAgents.includes(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                      active
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600"
                    )}
                  >
                    <span>@{agent.id}</span>
                    <span className="hidden text-[11px] text-gray-400 sm:inline">
                      {agent.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              Agents will only comment from their own domain perspective.
            </div>
            <Button onClick={runAgents} disabled={isLoading}>
              {isLoading ? "Running agents..." : "Run agents"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && rounds.length === 0 && <LoadingState variant="card" />}

      {rounds.length === 0 && !isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>How this works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>
              Ask a question once and see parallel responses from multiple AI agents, each
              focused on their own domain. Use @mentions to target specific agents.
            </p>
            <p>Example prompts:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                  @support @ops
                </code>{" "}
                Where are we seeing reliability issues that could hurt important accounts?
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                  @marketing @revenue
                </code>{" "}
                Which teams should we prioritize for expansion this month?
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-4 space-y-4">
        {rounds.map((round) => (
          <Card key={round.id} className="border-blue-100">
            <CardHeader className="border-b border-gray-100 pb-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    Prompt
                  </div>
                  <div className="text-sm text-gray-900">{round.question}</div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(round.createdAt).toLocaleString()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {round.agents.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="flex flex-col rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-600/10 text-[11px] font-semibold text-blue-700 flex items-center justify-center">
                          {agent.agentLabel[0]}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-900">
                            {agent.agentLabel} agent
                          </div>
                          <div className="text-[11px] text-gray-500">
                            @{agent.agentId}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mb-2 text-xs text-gray-700">
                      {agent.report?.summary || "No summary returned."}
                    </div>
                    {agent.report?.keyMetrics && agent.report.keyMetrics.length > 0 && (
                      <div className="mb-2 space-y-1">
                        <div className="text-[11px] font-semibold uppercase text-gray-400">
                          Key metrics
                        </div>
                        {agent.report.keyMetrics.map((metric, idx) => (
                          <div
                            key={`${metric.label}-${idx}`}
                            className="flex items-center justify-between text-[11px] text-gray-700"
                          >
                            <span>{metric.label}</span>
                            <span className="font-medium">{metric.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {agent.report?.recommendations &&
                      agent.report.recommendations.length > 0 && (
                        <div className="mt-1 space-y-1">
                          <div className="text-[11px] font-semibold uppercase text-gray-400">
                            Recommendations
                          </div>
                          {agent.report.recommendations.map((rec, idx) => (
                            <div
                              key={`${rec.title}-${idx}`}
                              className="rounded-md bg-gray-50 p-2"
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-800">
                                  {rec.title}
                                </span>
                                <Badge
                                  variant={
                                    rec.severity === "high"
                                      ? "destructive"
                                      : rec.severity === "medium"
                                      ? "default"
                                      : "outline"
                                  }
                                  className="text-[10px]"
                                >
                                  {rec.severity}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-gray-700">
                                {rec.description}
                              </div>
                              {rec.impact && (
                                <div className="mt-1 text-[11px] text-gray-500">
                                  Impact: {rec.impact}
                                </div>
                              )}
                              {rec.suggestedActions &&
                                rec.suggestedActions.length > 0 && (
                                  <ul className="mt-1 list-disc pl-4 text-[11px] text-gray-700">
                                    {rec.suggestedActions.map((action, actionIdx) => (
                                      <li key={actionIdx}>{action}</li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


