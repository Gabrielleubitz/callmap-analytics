import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionCookie } from '@/lib/auth/session'
import { errorResponse } from '@/lib/utils/api-response'
import OpenAI from 'openai'

// Lazy initialization
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

const AGENTS = {
  marketing: {
    label: 'Marketing',
    description: 'Growth, acquisition, activation, and retention.',
  },
  support: {
    label: 'Support',
    description: 'Reliability issues and customer pain.',
  },
  product: {
    label: 'Product',
    description: 'Feature usage, stickiness, and UX.',
  },
  revenue: {
    label: 'Revenue',
    description: 'Plans, MRR, and monetization.',
  },
  ops: {
    label: 'Ops',
    description: 'Throughput, costs, and operational health.',
  },
}

type AgentId = keyof typeof AGENTS

/**
 * POST /api/analytics/copilot
 * Intelligent AI copilot that selects relevant agents and combines their responses
 */
export async function POST(request: NextRequest) {
  let decodedToken: any = null
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    decodedToken = await verifySessionCookie(sessionCookie)

    if (decodedToken.role !== 'superAdmin' && decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const question = (body.message || '').trim()

    if (!question) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Step 1: Determine which agents are relevant to this question
    const agentSelectionPrompt = `You are analyzing a question for CallMap's analytics dashboard.

Question: "${question}"

Available agents:
- marketing: Growth, acquisition, activation, and retention
- support: Reliability issues and customer pain
- product: Feature usage, stickiness, and UX
- revenue: Plans, MRR, and monetization
- ops: Throughput, costs, and operational health

Determine which agents (1-3) are most relevant to answer this question. Return a JSON array of agent IDs.
Example: ["revenue", "marketing"] or ["ops"] or ["product", "support"]

Return only the JSON array, no other text.`

    let relevantAgents: AgentId[] = ['ops'] // Default fallback

    try {
      const selectionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: agentSelectionPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const selectionContent = selectionResponse.choices[0].message.content
      if (selectionContent) {
        const parsed = JSON.parse(selectionContent)
        const agents = parsed.agents || parsed.relevantAgents || []
        relevantAgents = agents.filter((id: string) => id in AGENTS) as AgentId[]
        if (relevantAgents.length === 0) {
          relevantAgents = ['ops']
        }
      }
    } catch (error) {
      console.error('[Copilot] Agent selection failed, using default:', error)
    }

    // Step 2: Call the AI agents API with only relevant agents
    const agentsResponse = await fetch(new URL('/api/admin/ai-agents', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        message: question,
        agents: relevantAgents,
      }),
    })

    if (!agentsResponse.ok) {
      const errorData = await agentsResponse.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to get agent responses')
    }

    const agentsData = await agentsResponse.json()
    const agentReports = agentsData.agents || []

    // Step 3: Combine agent responses into a single cohesive answer
    const combinationPrompt = `You are synthesizing responses from multiple AI agents to answer a user's question.

Question: "${question}"

Agent responses:
${agentReports.map((agent: any) => `
${agent.agentLabel} (${agent.agentId}):
${agent.report?.summary || 'No summary available'}
${agent.report?.keyMetrics ? `\nKey Metrics: ${JSON.stringify(agent.report.keyMetrics)}` : ''}
${agent.report?.recommendations ? `\nRecommendations: ${JSON.stringify(agent.report.recommendations)}` : ''}
`).join('\n---\n')}

Synthesize these responses into a single, cohesive answer that:
1. Directly answers the user's question
2. Combines insights from all relevant agents
3. Highlights key metrics and recommendations
4. Is clear, actionable, and well-structured

Return as JSON:
{
  "answer": "Your synthesized answer (2-4 paragraphs)",
  "keyMetrics": [{"label": "...", "value": "...", "trend": "up|down|flat|null"}],
  "recommendations": [{"title": "...", "severity": "low|medium|high", "description": "...", "impact": "...", "suggestedActions": ["..."]}]
}`

    let combinedAnswer = {
      answer: '',
      keyMetrics: [] as any[],
      recommendations: [] as any[],
    }

    try {
      const combinationResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: combinationPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const combinationContent = combinationResponse.choices[0].message.content
      if (combinationContent) {
        const parsed = JSON.parse(combinationContent)
        combinedAnswer = {
          answer: parsed.answer || 'Unable to generate answer.',
          keyMetrics: parsed.keyMetrics || [],
          recommendations: parsed.recommendations || [],
        }
      }
    } catch (error) {
      console.error('[Copilot] Answer combination failed:', error)
      // Fallback: combine summaries manually
      const summaries = agentReports
        .map((agent: any) => agent.report?.summary)
        .filter(Boolean)
        .join('\n\n')
      combinedAnswer.answer = summaries || 'Unable to generate answer.'
    }

    // Extract all key metrics and recommendations from agent reports
    const allMetrics = new Map<string, any>()
    const allRecommendations: any[] = []

    agentReports.forEach((agent: any) => {
      if (agent.report?.keyMetrics) {
        agent.report.keyMetrics.forEach((metric: any) => {
          allMetrics.set(metric.label, metric)
        })
      }
      if (agent.report?.recommendations) {
        allRecommendations.push(...agent.report.recommendations)
      }
    })

    // Merge with combined answer metrics/recommendations
    combinedAnswer.keyMetrics = Array.from(allMetrics.values())
    if (combinedAnswer.recommendations.length === 0) {
      combinedAnswer.recommendations = allRecommendations
    }

    return NextResponse.json({
      answer: combinedAnswer.answer,
      keyMetrics: combinedAnswer.keyMetrics,
      recommendations: combinedAnswer.recommendations,
      contributingAgents: relevantAgents.map((id) => ({
        id,
        label: AGENTS[id].label,
      })),
    })
  } catch (error: any) {
    console.error('[Copilot] Error:', error)
    
    // Capture error for support
    const { captureException } = await import('@/lib/support/capture-error')
    captureException(error, {
      app_area: 'ai_copilot',
      route: request.url,
      action: 'run_copilot',
      user_id: decodedToken?.uid || null,
      source: 'server',
    })
    
    return errorResponse(error.message || 'Failed to generate copilot response', 500)
  }
}

