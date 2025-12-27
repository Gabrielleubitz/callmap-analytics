import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifySessionCookie } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { detectAnomalies } from '@/lib/utils/anomaly-detection'
import { FIRESTORE_COLLECTIONS } from '@/lib/config'
import * as admin from 'firebase-admin'
import { errorResponse } from '@/lib/utils/api-response'
import OpenAI from 'openai'

// Lazy initialization to avoid build-time errors
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

/**
 * Generate AI-Powered Insights
 * 
 * Analyzes current metrics and generates:
 * - Daily/weekly summary of key changes
 * - Anomaly detection results
 * - Trend analysis
 * - Actionable recommendations
 */

interface Insight {
  id: string
  type: 'summary' | 'anomaly' | 'trend' | 'recommendation'
  title: string
  description: string
  severity?: 'info' | 'warning' | 'critical'
  metrics?: Record<string, any>
  timestamp: string
  generated_at: string
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

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const body = await request.json()
    const { period = 'daily' } = body // 'daily' or 'weekly'

    const now = new Date()
    const startDate = new Date(now)
    if (period === 'daily') {
      startDate.setDate(startDate.getDate() - 1)
    } else {
      startDate.setDate(startDate.getDate() - 7)
    }

    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate)
    const endTimestamp = admin.firestore.Timestamp.fromDate(now)

    // Get key metrics for the period
    const usersSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.users)
      .get()
      .catch(() => ({ size: 0, docs: [] } as any))

    const mindmapsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.sessions)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
      .catch(() => ({ size: 0, docs: [] } as any))

    const jobsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
      .catch(() => ({ docs: [] } as any))

    // Calculate metrics
    let totalTokens = 0
    let totalCost = 0
    let failedJobs = 0
    for (const doc of jobsSnapshot.docs) {
      const data = doc.data()
      totalTokens += (data.tokensIn || 0) + (data.tokensOut || 0)
      totalCost += data.costUsd || data.cost || 0
      if (data.status === 'failed') {
        failedJobs++
      }
    }

    const jobFailureRate = jobsSnapshot.docs.length > 0
      ? failedJobs / jobsSnapshot.docs.length
      : 0

    // Get previous period for comparison
    const prevStartDate = new Date(startDate)
    if (period === 'daily') {
      prevStartDate.setDate(prevStartDate.getDate() - 1)
    } else {
      prevStartDate.setDate(prevStartDate.getDate() - 7)
    }
    const prevStartTimestamp = admin.firestore.Timestamp.fromDate(prevStartDate)
    const prevEndTimestamp = admin.firestore.Timestamp.fromDate(startDate)

    const prevMindmapsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.sessions)
      .where('createdAt', '>=', prevStartTimestamp)
      .where('createdAt', '<', prevEndTimestamp)
      .get()
      .catch(() => ({ size: 0 } as any))

    const prevJobsSnapshot = await adminDb
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', prevStartTimestamp)
      .where('createdAt', '<', prevEndTimestamp)
      .get()
      .catch(() => ({ docs: [] } as any))

    let prevTotalTokens = 0
    for (const doc of prevJobsSnapshot.docs) {
      const data = doc.data()
      prevTotalTokens += (data.tokensIn || 0) + (data.tokensOut || 0)
    }

    const mindmapsChange = prevMindmapsSnapshot.size > 0
      ? ((mindmapsSnapshot.size - prevMindmapsSnapshot.size) / prevMindmapsSnapshot.size) * 100
      : 0

    const tokensChange = prevTotalTokens > 0
      ? ((totalTokens - prevTotalTokens) / prevTotalTokens) * 100
      : 0

    // Detect anomalies
    const anomalies = await detectAnomalies()

    // Generate AI insights
    const insights: Insight[] = []

    // Generate AI-powered summary
    const openai = getOpenAIClient()
    let summaryDescription = `In the last ${period === 'daily' ? '24 hours' : '7 days'}, ${mindmapsSnapshot.size} mindmaps were created, ${totalTokens.toLocaleString()} tokens were used (cost: $${totalCost.toFixed(2)}), and ${usersSnapshot.size} total users are active.`
    
    if (openai) {
      try {
        const summaryPrompt = `You are an analytics expert for CallMap, a SaaS platform that generates AI-powered mindmaps.

Generate a concise, insightful ${period === 'daily' ? 'daily' : 'weekly'} summary based on these metrics:

- Mindmaps created: ${mindmapsSnapshot.size} (${mindmapsChange > 0 ? '+' : ''}${mindmapsChange.toFixed(1)}% vs previous period)
- Tokens used: ${totalTokens.toLocaleString()} (${tokensChange > 0 ? '+' : ''}${tokensChange.toFixed(1)}% vs previous period)
- Cost: $${totalCost.toFixed(2)}
- Job failure rate: ${(jobFailureRate * 100).toFixed(1)}%
- Total active users: ${usersSnapshot.size}
${anomalies.length > 0 ? `- Anomalies detected: ${anomalies.length}` : ''}

Provide a 2-3 sentence summary that highlights key insights and trends. Be specific and data-driven. Return as JSON: {"summary": "your summary text"}`

        const summaryCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: summaryPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.5,
        })

        const summaryResponse = summaryCompletion.choices[0].message.content
        if (summaryResponse) {
          try {
            const parsed = JSON.parse(summaryResponse)
            if (parsed.summary) {
              summaryDescription = parsed.summary
            }
          } catch (parseError) {
            console.error('[Insights] Failed to parse AI summary:', parseError)
          }
        }
      } catch (summaryError) {
        console.error('[Insights] AI summary generation failed:', summaryError)
        // Fall back to default summary
      }
    }

    insights.push({
      id: `summary-${now.toISOString()}`,
      type: 'summary',
      title: `${period === 'daily' ? 'Daily' : 'Weekly'} Summary`,
      description: summaryDescription,
      metrics: {
        mindmaps: mindmapsSnapshot.size,
        tokens: totalTokens,
        cost: totalCost,
        users: usersSnapshot.size,
        jobFailureRate,
      },
      timestamp: now.toISOString(),
      generated_at: now.toISOString(),
    })

    // Trend insights
    if (Math.abs(mindmapsChange) > 10) {
      insights.push({
        id: `trend-mindmaps-${now.toISOString()}`,
        type: 'trend',
        title: 'Mindmap Creation Trend',
        description: `Mindmap creation is ${mindmapsChange > 0 ? 'up' : 'down'} ${Math.abs(mindmapsChange).toFixed(1)}% compared to the previous ${period === 'daily' ? 'day' : 'week'}.`,
        severity: mindmapsChange > 0 ? 'info' : 'warning',
        metrics: {
          current: mindmapsSnapshot.size,
          previous: prevMindmapsSnapshot.size,
          change: mindmapsChange,
        },
        timestamp: now.toISOString(),
        generated_at: now.toISOString(),
      })
    }

    if (Math.abs(tokensChange) > 15) {
      insights.push({
        id: `trend-tokens-${now.toISOString()}`,
        type: 'trend',
        title: 'Token Usage Trend',
        description: `Token usage is ${tokensChange > 0 ? 'up' : 'down'} ${Math.abs(tokensChange).toFixed(1)}% compared to the previous ${period === 'daily' ? 'day' : 'week'}.`,
        severity: tokensChange > 0 ? 'warning' : 'info',
        metrics: {
          current: totalTokens,
          previous: prevTotalTokens,
          change: tokensChange,
        },
        timestamp: now.toISOString(),
        generated_at: now.toISOString(),
      })
    }

    // Anomaly insights
    for (const anomaly of anomalies) {
      insights.push({
        id: `anomaly-${anomaly.id}`,
        type: 'anomaly',
        title: `Anomaly Detected: ${anomaly.metric}`,
        description: anomaly.message,
        severity: anomaly.severity,
        metrics: {
          current: anomaly.currentValue,
          expected: anomaly.expectedValue,
          deviation: anomaly.deviation,
        },
        timestamp: anomaly.timestamp.toISOString(),
        generated_at: now.toISOString(),
      })
    }

    // Generate AI recommendations
    if (openai) {
      try {
        const prompt = `You are an analytics expert for CallMap, a SaaS platform that generates AI-powered mindmaps.

Current metrics for the last ${period}:
- Mindmaps created: ${mindmapsSnapshot.size} (${mindmapsChange > 0 ? '+' : ''}${mindmapsChange.toFixed(1)}% vs previous period)
- Tokens used: ${totalTokens.toLocaleString()} (${tokensChange > 0 ? '+' : ''}${tokensChange.toFixed(1)}% vs previous period)
- Cost: $${totalCost.toFixed(2)}
- Job failure rate: ${(jobFailureRate * 100).toFixed(1)}%
- Total users: ${usersSnapshot.size}
${anomalies.length > 0 ? `\nAnomalies detected: ${anomalies.length}` : ''}

Provide 2-3 actionable recommendations for improving the business. Be specific and data-driven. Return as JSON array with objects containing "title" and "description" fields.`

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
              const recommendations = parsed.recommendations || parsed.items || []
              
              for (const rec of recommendations) {
                insights.push({
                  id: `recommendation-${Date.now()}-${Math.random()}`,
                  type: 'recommendation',
                  title: rec.title || 'Recommendation',
                  description: rec.description || rec.message || '',
                  severity: 'info',
                  timestamp: now.toISOString(),
                  generated_at: now.toISOString(),
                })
              }
            } catch (parseError) {
              console.error('[Insights] Failed to parse AI response:', parseError)
            }
          }
      } catch (aiError) {
        console.error('[Insights] AI generation failed:', aiError)
        // Continue without AI recommendations
      }
    }

    // Store insights in cache
    const insightsRef = adminDb.collection(FIRESTORE_COLLECTIONS.insights).doc()
    await insightsRef.set({
      period,
      insights,
      generated_at: admin.firestore.Timestamp.now(),
      generated_by: decodedToken.uid,
    })

    return NextResponse.json({ data: insights })
  } catch (error: any) {
    console.error('[Insights Generate] Error:', error)
    return errorResponse(error.message || 'Failed to generate insights', 500)
  }
}

/**
 * GET /api/insights/generate
 * Get cached insights
 */
export async function GET(request: NextRequest) {
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

    if (!adminDb) {
      return errorResponse('Database not initialized', 500)
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'daily'

    // Get most recent insights (handle missing index gracefully)
    let insightsSnapshot
    try {
      insightsSnapshot = await adminDb
        .collection(FIRESTORE_COLLECTIONS.insights)
        .where('period', '==', period)
        .orderBy('generated_at', 'desc')
        .limit(1)
        .get()
    } catch (indexError: any) {
      // If index doesn't exist, fetch all and sort in memory
      console.warn('[Insights] Missing Firestore index, using fallback:', indexError.message)
      const allInsights = await adminDb
        .collection(FIRESTORE_COLLECTIONS.insights)
        .where('period', '==', period)
        .get()
      
      if (allInsights.empty) {
        return NextResponse.json({ data: [] })
      }
      
      // Sort by generated_at in memory
      const sorted = allInsights.docs.sort((a, b) => {
        const aTime = a.data().generated_at?.toMillis?.() || 0
        const bTime = b.data().generated_at?.toMillis?.() || 0
        return bTime - aTime
      })
      
      const insightsData = sorted[0].data()
      return NextResponse.json({ data: insightsData.insights || [] })
    }

    if (insightsSnapshot.empty) {
      return NextResponse.json({ data: [] })
    }

    const insightsData = insightsSnapshot.docs[0].data()
    return NextResponse.json({ data: insightsData.insights || [] })
  } catch (error: any) {
    console.error('[Insights Get] Error:', error)
    return errorResponse(error.message || 'Failed to fetch insights', 500)
  }
}

