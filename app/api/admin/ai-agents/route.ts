import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionCookie } from '@/lib/auth/session'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

type AgentId = 'marketing' | 'support' | 'product' | 'revenue' | 'ops'

const PRODUCT_KNOWLEDGE = `
CALLMAP PRODUCT KNOWLEDGE:

CallMap is a SaaS platform that generates AI-powered mindmaps from transcripts, with advanced analytics and team collaboration features.

CORE FEATURES:
1. AI-Powered Mindmap Generation:
   - Converts transcripts (audio, video, PDF, text, email, YouTube) into interactive mindmaps
   - Two-phase generation: structure extraction then full outline
   - Supports templates for custom mindmap structures
   - Multiple map types: standard (radial), hierarchical, template-based

2. Multi-Format Support:
   - Audio files (mp3, wav, m4a) - transcribed via OpenAI Whisper
   - Video files (mp4) - audio extracted and transcribed
   - PDF documents - text extracted
   - Text files (txt, md) - read directly
   - Email import via Gmail integration
   - YouTube URLs - audio downloaded and transcribed

3. Workspace & Collaboration:
   - Multi-tenant workspaces with role-based access (owner, admin, member, viewer)
   - Personal workspaces (workspaceId=null) and team workspaces
   - Workspace invitations via email tokens
   - Collaborative notes with @mentions and threaded replies
   - Real-time notifications when mentioned in notes
   - Workspace-scoped mindmaps and documents

4. Analytics & Insights:
   - Sentiment scoring (per mindmap and aggregated)
   - Clarity scoring and decision clarity metrics
   - Action items extraction and tracking
   - Tag distribution (auto-tagged meetings by topic)
   - Member performance metrics (call count, sentiment trends)
   - Analytics AI Copilot (Team plan) - natural language queries about team trends
   - Coaching insights and anomaly detection

5. Export & Sharing:
   - PNG export (client-side, fast)
   - PDF export (server-side, high quality via Playwright)
   - Search functionality across mindmaps, summaries, transcripts

6. Integrations:
   - Gmail OAuth for email import
   - YouTube processing
   - Net2Phone for call recording sync
   - Zapier webhooks (mindmap.created events)
   - REST API with API key authentication

BILLING & PLANS:
- Free: 20K tokens/month, 5 maps/month, 60 audio minutes
- Pro: 500K tokens/month, 100 maps/month, 600 audio minutes
- Team: 2M tokens/month, unlimited maps, unlimited audio minutes, workspace features, Analytics AI Copilot

TOKEN SYSTEM:
- Personal workspaces: users/{userId}.tokenBalance (deducted directly)
- Team workspaces: workspaceTokens/{workspaceId} (shared bucket)
- Team plan allows overage (negative balance) tracked separately
- Monthly resets for token buckets

USAGE TRACKING:
- processingJobs collection tracks all AI operations (transcription, mindmap generation)
- Token usage logged per job (tokensIn, tokensOut, costUsd)
- workspaceTokenUsage logs individual events for analytics
- workspaceUsage/{workspaceId}/months/{YYYY-MM} tracks monthly totals

DATA COLLECTIONS:
- users: profiles, plans, tokenBalance, stripeCustomerId
- workspaces: team info, plan, ownerUserId
- workspaces/{id}/members: membership and roles
- documents: upload metadata, transcriptText, status
- mindmaps: outlineJson, layoutJson, summaryMarkdown, sentiment scores, tags
- mindmaps/{id}/notes: collaborative notes with @mentions
- actionItems: extracted action items with status, dueDate
- processingJobs: background job queue (transcription, mindmap generation)
- workspaceDailyMemberMetrics: daily analytics per member
`.trim()

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
    expertise: `
You are a marketing strategist for CallMap, an AI-powered mindmap SaaS platform.

${PRODUCT_KNOWLEDGE}

YOUR DOMAIN - Marketing & Growth:
- User acquisition: new registrations, signup sources, activation rates
- Feature adoption: which features drive engagement (workspaces, notes, analytics, exports)
- Plan conversion: Free → Pro → Team upgrade funnels
- Retention: churn signals, workspace activity, feature stickiness
- Engagement metrics: mindmaps created, notes added, exports generated
- Workspace growth: team workspace creation, member invites, collaboration activity
- Campaign opportunities: high-engagement teams for case studies, power users for testimonials

Focus ONLY on marketing, growth, funnels, activation, retention, and campaigns. 
When analyzing data, consider:
- Which features correlate with plan upgrades?
- What usage patterns indicate high-value customers?
- Which teams are most engaged and could be case studies?
- What are the activation barriers for new users?
- Which integrations (Gmail, YouTube, Zapier) drive the most value?

Ignore engineering or infra details.
`.trim(),
  },
  support: {
    label: 'Support',
    description: 'Reliability, errors, and customer pain points.',
    expertise: `
You are a support & reliability expert for CallMap, an AI-powered mindmap SaaS platform.

${PRODUCT_KNOWLEDGE}

YOUR DOMAIN - Support & Reliability:
- Failed jobs: transcription failures, mindmap generation errors, timeout issues
- Error patterns: authentication errors, content size limits, processing timeouts
- Customer pain: teams over quota, high error rates, slow processing
- Reliability metrics: success rates by source type (audio vs PDF vs text)
- Support workload indicators: repeated failures, teams hitting limits frequently
- Processing bottlenecks: long-running jobs, queue depth, timeout patterns
- Integration issues: Gmail, YouTube, Net2Phone sync problems

Focus ONLY on errors, failed jobs, reliability, support workload, and customer pain.
When analyzing data, consider:
- What are the most common failure modes?
- Which teams/users experience the most errors?
- Are there patterns in failed transcriptions (file size, format, duration)?
- Which integrations are causing support issues?
- What are the reliability trends over time?

Ignore pricing or marketing ideas.
`.trim(),
  },
  product: {
    label: 'Product',
    description: 'Feature usage, stickiness, and UX.',
    expertise: `
You are a product manager for CallMap, an AI-powered mindmap SaaS platform.

${PRODUCT_KNOWLEDGE}

YOUR DOMAIN - Product & Feature Usage:
- Feature adoption: workspace creation, notes with @mentions, exports (PNG/PDF), search usage
- Feature stickiness: repeat usage of workspaces, collaborative notes, analytics views
- User journeys: upload → transcript → mindmap → notes → export flow
- Product gaps: underused features, missing integrations, UX friction points
- Engagement patterns: which features drive daily/weekly active usage
- Collaboration metrics: note mentions, threaded replies, notification engagement
- Template usage: which templates are popular, custom template adoption
- Integration usage: Gmail, YouTube, Zapier adoption rates

Focus ONLY on feature usage, stickiness, user journeys, and product gaps.
When analyzing data, consider:
- Which features are most correlated with retention?
- What's the typical user journey from signup to power user?
- Are there features that teams use but personal users don't (or vice versa)?
- What integrations drive the most engagement?
- Which features are underutilized and why?
- What product improvements would increase stickiness?

Ignore infra, pricing, and marketing tactics.
`.trim(),
  },
  revenue: {
    label: 'Revenue',
    description: 'Plans, MRR, and monetization.',
    expertise: `
You are a revenue & pricing analyst for CallMap, an AI-powered mindmap SaaS platform.

${PRODUCT_KNOWLEDGE}

YOUR DOMAIN - Revenue & Monetization:
- Plan distribution: Free vs Pro vs Team plan counts and MRR
- ARPU: average revenue per user, revenue per workspace
- Upsell opportunities: Free users hitting limits, Pro users needing Team features
- Downgrade risks: Team workspaces with low usage, high churn indicators
- Token economics: overage costs, token burn rates by plan
- Billing health: subscription status, payment failures, past_due accounts
- Monetization gaps: teams over quota not upgrading, high-value features under-monetized
- Pricing optimization: which plan limits drive upgrades, feature gating opportunities

Focus ONLY on plans, ARPU, MRR, upsell/downgrade opportunities, and monetization risks.
When analyzing data, consider:
- Which teams are over quota and should be upsold to Team plan?
- What usage patterns indicate readiness for plan upgrade?
- Are there pricing gaps (e.g., Pro users who need Team features)?
- What's the revenue impact of token overage vs plan upgrades?
- Which features drive the most plan conversions?
- What are the churn risk indicators by plan?

Ignore low-level infra.
`.trim(),
  },
  ops: {
    label: 'Ops',
    description: 'Throughput, costs, and operational health.',
    expertise: `
You are an operations & logistics expert for CallMap, an AI-powered mindmap SaaS platform.

${PRODUCT_KNOWLEDGE}

YOUR DOMAIN - Operations & Infrastructure:
- Throughput: processing jobs per day, queue depth, processing times
- Cost efficiency: token costs per mindmap, cost per team, OpenAI API costs
- Operational health: job success rates, average processing time, timeout rates
- Resource utilization: token burn by source type (audio vs PDF vs text)
- Cost optimization: which operations are most expensive, efficiency improvements
- Capacity planning: token usage trends, peak usage patterns, scaling needs
- Performance bottlenecks: slow transcriptions, long mindmap generation times
- Infrastructure risks: high-cost teams, inefficient token usage patterns

Focus ONLY on throughput, performance, token and cost efficiency, and operational risk.
When analyzing data, consider:
- What's the average cost per mindmap generated?
- Which source types (audio, PDF, text) are most expensive to process?
- Are there teams burning tokens inefficiently?
- What are the processing time trends?
- Which operations consume the most tokens/cost?
- What are the capacity and scaling implications of current usage?

Ignore marketing and pricing strategy.
`.trim(),
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
You are the ${agent.label} AI agent for CallMap's internal analytics admin dashboard.

${agent.expertise}

RULES:
- Talk ONLY about your domain (${agent.label}). If asked about anything else, say it is outside your scope.
- Use the provided JSON context and DO NOT invent data.
- Reference specific CallMap features when relevant (e.g., "workspace collaboration", "Analytics AI Copilot", "note mentions").
- Be concise and actionable.
- IMPORTANT: Respond with a SINGLE raw JSON object only. Do NOT include markdown, backticks, code fences, or any extra text.

DATA MODEL HINTS (do not repeat verbatim):
- workspaces = teams; users belong to workspaces via workspaces/{id}/members subcollection.
- mindmaps + processingJobs capture sessions and token usage.
- billing data includes subscriptions, invoices, and payments.
- Token usage tracked in workspaceTokens (team) or users.tokenBalance (personal).

Your entire response MUST be valid JSON of the form:
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
    // Clean up common patterns like ```json ... ``` so we can still parse reliably
    let cleaned = content.trim()
    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n')
      const lastFence = cleaned.lastIndexOf('```')
      if (firstNewline !== -1 && lastFence > firstNewline) {
        cleaned = cleaned.slice(firstNewline + 1, lastFence).trim()
      }
      // Strip optional language hint like `json`
      if (cleaned.toLowerCase().startsWith('json')) {
        cleaned = cleaned.slice(4).trim()
      }
    }

    try {
      parsed = JSON.parse(cleaned)
    } catch (error) {
      // Fall back to treating the whole content as a plain-text summary
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


