import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
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

/**
 * POST /api/ai/explain-page
 * Generate AI explanation of what the user is looking at
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    const decodedToken = authResult.decodedToken

    // SECURITY: Rate limit explain page requests (20 per minute per user)
    const { checkRateLimitKV, getClientIdentifier } = await import('@/lib/auth/rate-limit-kv')
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await checkRateLimitKV(
      `explain-page:${decodedToken.uid}`,
      20, // 20 requests
      60 * 1000, // per minute
      request
    )

    if (rateLimitResult.rateLimited) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      )
    }

    const body = await request.json()
    const { pageName, description, metrics, data } = body

    // SECURITY: Sanitize and redact sensitive data before sending to LLM
    const { sanitizeUserInput, redactSecrets } = await import('@/lib/security/ai-redaction')
    const sanitizedPageName = sanitizeUserInput(pageName || '')
    const sanitizedDescription = description ? sanitizeUserInput(description) : undefined
    const sanitizedMetrics = metrics ? redactSecrets(JSON.stringify(metrics)) : undefined
    const sanitizedData = data ? redactSecrets(JSON.stringify(data)) : undefined

    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json({
        explanation: 'AI explanations are not available. Please configure OPENAI_API_KEY.',
      })
    }

    // Build context for AI using sanitized data
    let contextText = `Page: ${sanitizedPageName}\n`
    if (sanitizedDescription) {
      contextText += `Description: ${sanitizedDescription}\n`
    }
    if (sanitizedMetrics) {
      contextText += `\nKey Metrics:\n${sanitizedMetrics}\n`
    }
    if (sanitizedData) {
      // Summarize data if it's too large
      if (sanitizedData.length > 2000) {
        const dataObj = data ? JSON.parse(JSON.stringify(data)) : {}
        contextText += `\nData Summary: ${Object.keys(dataObj).length} items\n`
      } else {
        contextText += `\nData: ${sanitizedData}\n`
      }
    }

    const prompt = `You are an AI coach for CallMap's analytics dashboard. A user is looking at the "${sanitizedPageName}" page.

${contextText}

Provide a structured response with:
1. "overview": A simple 2-3 sentence explanation of what this page shows and what the user is looking at
2. "keyTakeaways": An array of 3-5 key insights or important points from the data (each as a string)
3. "suggestedAgents": An array of 1-3 agent IDs that would be most relevant for this page. Choose from: "marketing", "support", "product", "revenue", "ops"
4. "suggestedPrompt": A suggested question/prompt the user could ask the AI agents about this page

Return as JSON with this exact structure:
{
  "overview": "simple explanation text",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "suggestedAgents": ["agent1", "agent2"],
  "suggestedPrompt": "suggested question text"
}`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const response = completion.choices[0].message.content
      if (response) {
        try {
          const parsed = JSON.parse(response)
          return NextResponse.json({
            overview: parsed.overview || `This is the ${pageName} page. ${description || 'It displays analytics and metrics related to your CallMap data.'}`,
            keyTakeaways: parsed.keyTakeaways || [],
            suggestedAgents: parsed.suggestedAgents || ['ops'],
            suggestedPrompt: parsed.suggestedPrompt || `Tell me more about the ${pageName} data and what I should focus on.`,
          })
        } catch (parseError) {
          console.error('[AI Explain] Failed to parse response:', parseError)
        }
      }
    } catch (aiError) {
      console.error('[AI Explain] AI generation failed:', aiError)
    }

    // Fallback response
    return NextResponse.json({
      overview: `This is the ${pageName} page. ${description || 'It displays analytics and metrics related to your CallMap data.'}`,
      keyTakeaways: [],
      suggestedAgents: ['ops'],
      suggestedPrompt: `Tell me more about the ${pageName} data and what I should focus on.`,
    })
  } catch (error: any) {
    console.error('[AI Explain] Error:', error)
    return errorResponse(error.message || 'Failed to generate explanation', 500)
  }
}

