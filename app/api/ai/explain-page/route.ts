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

Provide a clear, concise explanation (2-4 sentences) of:
1. What this page shows
2. What the key metrics/data mean
3. What actions or insights they should focus on

Be conversational and helpful. Return as JSON: {"explanation": "your explanation text"}`

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
            explanation: parsed.explanation || 'Unable to generate explanation.',
          })
        } catch (parseError) {
          console.error('[AI Explain] Failed to parse response:', parseError)
        }
      }
    } catch (aiError) {
      console.error('[AI Explain] AI generation failed:', aiError)
    }

    // Fallback explanation
    return NextResponse.json({
      explanation: `This is the ${pageName} page. ${description || 'It displays analytics and metrics related to your CallMap data.'}`,
    })
  } catch (error: any) {
    console.error('[AI Explain] Error:', error)
    return errorResponse(error.message || 'Failed to generate explanation', 500)
  }
}

