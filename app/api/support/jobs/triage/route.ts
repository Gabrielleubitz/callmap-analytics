/**
 * AI Triage Background Job
 * 
 * POST /api/support/jobs/triage
 * 
 * Protected by CRON_SECRET. Analyzes pending errors using OpenAI and KB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import { SupportErrorEvent, SupportErrorTriage } from '@/lib/types'
import * as admin from 'firebase-admin'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export async function POST(request: NextRequest) {
  try {
    // Verify CRON secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-production'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Get pending errors (limit to 10 per run)
    const pendingErrors = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrors)
      .where('triage_status', '==', 'pending')
      .limit(10)
      .get()

    if (pendingErrors.empty) {
      return NextResponse.json({ processed: 0, message: 'No pending errors' })
    }

    // Get all KB entries for matching
    const kbSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.supportErrorKB)
      .get()

    const kbEntries = kbSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{
      id: string
      error_pattern: string
      app_area?: string | null
      root_causes?: string[]
      fix_steps?: string[]
    }>

    let processed = 0

    for (const errorDoc of pendingErrors.docs) {
      try {
        // Mark as processing
        await errorDoc.ref.update({
          triage_status: 'processing',
        })

        const errorData = errorDoc.data() as any
        const error: SupportErrorEvent = {
          id: errorDoc.id,
          ...errorData,
          first_seen_at: errorData.first_seen_at?.toDate() || new Date(),
          last_seen_at: errorData.last_seen_at?.toDate() || new Date(),
          created_at: errorData.created_at?.toDate() || new Date(),
          updated_at: errorData.updated_at?.toDate() || new Date(),
          acknowledged_at: errorData.acknowledged_at?.toDate() || null,
          resolved_at: errorData.resolved_at?.toDate() || null,
        }

        // Find matching KB entries
        const matchingKB = kbEntries.filter(kb => {
          try {
            const pattern = new RegExp(kb.error_pattern, 'i')
            return pattern.test(error.message) || 
                   (kb.app_area && kb.app_area === error.app_area)
          } catch {
            return kb.error_pattern.toLowerCase().includes(error.message.toLowerCase()) ||
                   (kb.app_area && kb.app_area === error.app_area)
          }
        })

        // Build AI prompt
        const kbContext = matchingKB.length > 0
          ? `\n\nMatching Knowledge Base entries:\n${matchingKB.map((kb, i) => 
              `${i + 1}. Pattern: ${kb.error_pattern}\n   Root causes: ${kb.root_causes?.join(', ')}\n   Fix steps: ${kb.fix_steps?.join('; ')}`
            ).join('\n')}`
          : '\n\nNo matching Knowledge Base entries found.'

        const systemPrompt = `You are an expert support triage agent for CallMap, an AI-powered mindmap SaaS platform.

Analyze this error and provide:
1. A brief summary of what likely happened
2. Probable root causes (list 2-4)
3. Recommended fix steps (list 2-4 actionable steps)
4. Who should act: "user", "support", or "engineering"
5. A customer-facing message (clear, helpful, non-technical)
6. Confidence level (0-1)

Error details:
- Message: ${error.message}
- App area: ${error.app_area}
- Route: ${error.route || 'N/A'}
- Expected: ${error.expected}
- Critical: ${error.critical}
- Occurrences: ${error.occurrence_count}
${kbContext}

Respond with valid JSON only:
{
  "summary": "string",
  "probable_causes": ["cause1", "cause2"],
  "recommended_fixes": ["fix1", "fix2"],
  "who_should_act": "user|support|engineering",
  "customer_facing_message": "string",
  "confidence": 0.0-1.0
}`

        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Analyze this error.' },
            ],
            temperature: 0.2,
          }),
        })

        if (!response.ok) {
          throw new Error(`OpenAI error: ${response.status}`)
        }

        const json = await response.json()
        const content = json.choices?.[0]?.message?.content || ''

        // Parse AI response
        let parsed: any = null
        try {
          let cleaned = content.trim()
          if (cleaned.startsWith('```')) {
            const firstNewline = cleaned.indexOf('\n')
            const lastFence = cleaned.lastIndexOf('```')
            if (firstNewline !== -1 && lastFence > firstNewline) {
              cleaned = cleaned.slice(firstNewline + 1, lastFence).trim()
            }
            if (cleaned.toLowerCase().startsWith('json')) {
              cleaned = cleaned.slice(4).trim()
            }
          }
          parsed = JSON.parse(cleaned)
        } catch {
          // Fallback parsing
          parsed = {
            summary: content.substring(0, 200),
            probable_causes: ['Unable to parse AI response'],
            recommended_fixes: ['Review error manually'],
            who_should_act: 'support',
            customer_facing_message: 'We are investigating this issue.',
            confidence: 0.3,
          }
        }

        // Save triage result
        const triageRef = adminDb
          .collection(FIRESTORE_COLLECTIONS.supportErrorTriage)
          .doc()

        await triageRef.set({
          error_id: error.id,
          summary: parsed.summary || 'Analysis pending',
          probable_causes: parsed.probable_causes || [],
          recommended_fixes: parsed.recommended_fixes || [],
          who_should_act: parsed.who_should_act || 'support',
          confidence: parsed.confidence || 0.5,
          customer_facing_message: parsed.customer_facing_message || 'We are investigating this issue.',
          kb_entry_ids: matchingKB.map(kb => kb.id),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        })

        // Mark error as done
        await errorDoc.ref.update({
          triage_status: 'done',
        })

        processed++
      } catch (error: any) {
        console.error('[Triage] Error processing error:', error)
        // Mark as pending again to retry
        await errorDoc.ref.update({
          triage_status: 'pending',
        })
      }
    }

    return NextResponse.json({
      processed,
      message: `Processed ${processed} errors`,
    })
  } catch (error: any) {
    console.error('[Triage] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run triage' },
      { status: 500 }
    )
  }
}

