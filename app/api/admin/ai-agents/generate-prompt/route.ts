import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionCookie } from '@/lib/auth/session'
import { generateCursorPrompt } from '@/lib/ai-agents/prompt-generator'
import { errorResponse } from '@/lib/utils/api-response'

/**
 * POST /api/admin/ai-agents/generate-prompt
 * 
 * Generate a detailed Cursor prompt from an agent's answer
 */
export async function POST(request: NextRequest) {
  let decodedToken: any = null
  try {
    // SECURITY: Use centralized RBAC helper
    const { requireAdmin, authErrorResponse } = await import('@/lib/auth/permissions')
    const authResult = await requireAdmin(request)

    if (!authResult.success || !authResult.decodedToken) {
      return authErrorResponse(authResult)
    }

    decodedToken = authResult.decodedToken

    const body = await request.json()
    const { agentType, question, answer, tags, context } = body

    if (!agentType || !question || !answer) {
      return NextResponse.json(
        { error: 'agentType, question, and answer are required' },
        { status: 400 }
      )
    }

    if (agentType !== 'product' && agentType !== 'dev') {
      return NextResponse.json(
        { error: 'agentType must be "product" or "dev"' },
        { status: 400 }
      )
    }

    // Generate the prompt
    const prompt = generateCursorPrompt({
      agentType,
      question,
      answer,
      tags: tags || [],
      context: context || {},
    })

    return NextResponse.json({
      prompt,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Generate Prompt] Error:', error)
    
    // Capture error for support
    const { captureException } = await import('@/lib/support/capture-error')
    captureException(error, {
      app_area: 'ai_agents',
      route: request.url,
      action: 'generate_prompt',
      user_id: decodedToken?.uid || null,
      source: 'server',
    })
    
    return errorResponse(error.message || 'Failed to generate prompt', 500)
  }
}

