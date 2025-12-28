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

    const body = await request.json()
    const { pageName, description, metrics, data } = body

    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json({
        explanation: 'AI explanations are not available. Please configure OPENAI_API_KEY.',
      })
    }

    // Build context for AI
    let contextText = `Page: ${pageName}\n`
    if (description) {
      contextText += `Description: ${description}\n`
    }
    if (metrics) {
      contextText += `\nKey Metrics:\n${JSON.stringify(metrics, null, 2)}\n`
    }
    if (data) {
      // Summarize data if it's too large
      const dataStr = JSON.stringify(data)
      if (dataStr.length > 2000) {
        contextText += `\nData Summary: ${Object.keys(data).length} items\n`
      } else {
        contextText += `\nData: ${dataStr}\n`
      }
    }

    const prompt = `You are an AI coach for CallMap's analytics dashboard. A user is looking at the "${pageName}" page.

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

