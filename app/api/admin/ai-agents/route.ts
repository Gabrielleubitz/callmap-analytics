import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionCookie } from '@/lib/auth/session'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

type AgentId = 'marketing' | 'support' | 'product' | 'revenue' | 'ops'

const AGENTS: Record<
  AgentId,
  {
    label: string
    description: string
    expertise: string
  }
> = {
  marketing: {
    label: 'Marketing',
    description: 'Growth, acquisition, activation, and retention opportunities.',
    expertise:
      'You are a marketing strategist. Focus ONLY on marketing, growth, funnels, activation, retention, and campaigns. Ignore engineering or infra details.',
  },
  support: {
    label: 'Support',
    description: 'Reliability, errors, and customer pain points.',
    expertise:
      'You are a support & reliability expert. Focus ONLY on errors, failed jobs, reliability, support workload, and customer pain. Ignore pricing or marketing ideas.',
  },
  product: {
    label: 'Product',
    description: 'Feature usage, stickiness, and UX.',
    expertise:
      'You are a product manager. Focus ONLY on feature usage, stickiness, user journeys, and product gaps. Ignore infra, pricing, and marketing tactics.',
  },
  revenue: {
    label: 'Revenue',
    description: 'Plans, MRR, and monetization.',
    expertise:
      'You are a revenue & pricing analyst. Focus ONLY on plans, ARPU, MRR, upsell/downgrade opportunities, and monetization risks. Ignore low-level infra.',
  },
  ops: {
    label: 'Ops',
    description: 'Throughput, costs, and operational health.',
    expertise:
      'You are an operations & logistics expert. Focus ONLY on throughput, performance, token and cost efficiency, and operational risk.',
  },
}

interface AgentRunRequest {
  message: string
  agents?: AgentId[]
  // Optional lightweight history to give agents continuity between runs
  history?: {
    rounds: Array<{
      question: string
      responses: Array<{ agentId: AgentId; summary: string }>
    }>
  }
}

async function fetchJson(
  request: NextRequest,
  path: string,
  body: any
): Promise<any | null> {
  try {
    const url = new URL(path, request.url)
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn('[AI Agents] Failed to fetch', path, res.status)
      return null
    }
    return await res.json()
  } catch (error) {
    console.error('[AI Agents] Error fetching', path, error)
    return null
  }
}

async function buildContext(request: NextRequest) {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [overview, teamsOverQuota, topTeamsByTokens, topTeamsByCost, recentFailedJobs] =
    await Promise.all([
      fetchJson(request, '/api/analytics/overview', { start, end: now }),
      fetchJson(request, '/api/usage/teams-over-quota', {}),
      fetchJson(request, '/api/analytics/top-teams-by-tokens', {
        limit: 20,
        range: { start, end: now },
      }),
      fetchJson(request, '/api/analytics/top-teams-by-cost', {
        limit: 20,
        range: { start, end: now },
      }),
      fetchJson(request, '/api/analytics/recent-failed-jobs', { limit: 50 }),
    ])

  return {
    generatedAt: now.toISOString(),
    range: { start: start.toISOString(), end: now.toISOString() },
    overview,
    teamsOverQuota,
    topTeamsByTokens,
    topTeamsByCost,
    recentFailedJobs,
  }
}

async function runAgent(
  agentId: AgentId,
  input: AgentRunRequest,
  context: any
): Promise<any> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const agent = AGENTS[agentId]

  // Build a short, agent-specific conversation history
  const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (input.history?.rounds) {
    for (const round of input.history.rounds.slice(-5)) {
      const response = round.responses.find((r) => r.agentId === agentId)
      if (response) {
        historyMessages.push({
          role: 'user',
          content: round.question,
        })
        historyMessages.push({
          role: 'assistant',
          content: response.summary,
        })
      }
    }
  }

  const systemPrompt = `
You are the ${agent.label} AI agent for an internal analytics admin dashboard.

${agent.expertise}

RULES:
- Talk ONLY about your domain (${agent.label}). If asked about anything else, say it is outside your scope.
- Use the provided JSON context and DO NOT invent data.
- Be concise and actionable.

DATA MODEL HINTS (do not repeat verbatim):
- workspaces = teams; users belong to workspaces via members.
- mindmaps + processingJobs capture sessions and token usage.
- billing data includes subscriptions, invoices, and payments.

Respond in *valid JSON* with:
{
  "summary": "1-3 sentence overview from your expert lens",
  "keyMetrics": [
    { "label": "string", "value": "string or number", "trend": "up|down|flat|null" }
  ],
  "recommendations": [
    {
      "title": "short name",
      "severity": "low|medium|high",
      "description": "what you see",
      "impact": "why it matters",
      "suggestedActions": ["bullet 1", "bullet 2"]
    }
  ]
}
`.trim()

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Here is the latest data context as JSON:\n\n${JSON.stringify(
        context,
        null,
        2
      )}`,
    },
    ...historyMessages,
    {
      role: 'user',
      content: `New admin question or prompt: ${input.message}`,
    },
  ]

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error (${response.status}): ${text}`)
  }

  const json = (await response.json()) as any
  const content: string | undefined =
    json.choices?.[0]?.message?.content || json.choices?.[0]?.message?.content?.[0]?.text

  let parsed: any = null
  if (content) {
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      parsed = { summary: content, keyMetrics: [], recommendations: [] }
    }
  }

  return {
    agentId,
    agentLabel: agent.label,
    raw: json,
    report: parsed,
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as AgentRunRequest
    const message = (body.message || '').trim()
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const requestedAgents = (body.agents && body.agents.length
      ? body.agents
      : (Object.keys(AGENTS) as AgentId[])
    ).filter((id): id is AgentId => id in AGENTS)

    if (requestedAgents.length === 0) {
      return NextResponse.json({ error: 'No valid agents requested' }, { status: 400 })
    }

    const context = await buildContext(request)

    const results = await Promise.all(
      requestedAgents.map((agentId) => runAgent(agentId, body, context))
    )

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      contextRange: context.range,
      agents: results,
    })
  } catch (error: any) {
    console.error('[AI Agents] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI agent reports' },
      { status: 500 }
    )
  }
}


