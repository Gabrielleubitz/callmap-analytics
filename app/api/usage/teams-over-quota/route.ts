import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    // Get all workspaces
    const workspacesSnapshot = await adminDb.collection('workspaces').get()
    const result: Array<{ team_id: string; team_name: string; quota: number; used: number; percentage: number }> = []

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    for (const workspaceDoc of workspacesSnapshot.docs) {
      const workspaceData = workspaceDoc.data()
      const plan = workspaceData.plan || 'free'
      
      // Define quotas by plan
      const quotas: Record<string, number> = {
        free: 10000,
        pro: 100000,
        team: 500000,
        enterprise: 10000000,
      }
      
      const quota = quotas[plan] || 10000
      
      // Get usage for this workspace
      let used = 0
      try {
        // Try to get from usage collection
        const usageSnapshot = await adminDb.collection('usage').get()
        for (const userDoc of usageSnapshot.docs) {
          const userData = userDoc.data()
          if (userData.workspaceId === workspaceDoc.id || userData.teamId === workspaceDoc.id) {
            const monthsSnapshot = await userDoc.ref.collection('months').get()
            monthsSnapshot.forEach((monthDoc) => {
              const monthData = monthDoc.data()
              if (monthData.month === currentMonth) {
                used += (monthData.promptTokens || 0) + (monthData.completionTokens || 0)
              }
            })
          }
        }
      } catch (error) {
        // If usage collection doesn't work, try processingJobs
        try {
          const jobsSnapshot = await adminDb
            .collection('processingJobs')
            .where('workspaceId', '==', workspaceDoc.id)
            .get()
          
          jobsSnapshot.forEach((jobDoc) => {
            const jobData = jobDoc.data()
            const createdAt = jobData.createdAt?.toDate?.() || jobData.createdAt
            if (createdAt && createdAt.toISOString().slice(0, 7) === currentMonth) {
              used += (jobData.tokensIn || 0) + (jobData.tokensOut || 0)
            }
          })
        } catch (jobsError) {
          // Ignore
        }
      }

      const percentage = quota > 0 ? (used / quota) * 100 : 0

      // Only include teams over 80% of quota
      if (percentage >= 80) {
        result.push({
          team_id: workspaceDoc.id,
          team_name: workspaceData.name || workspaceDoc.id,
          quota,
          used,
          percentage,
        })
      }
    }

    // Sort by percentage descending
    result.sort((a, b) => b.percentage - a.percentage)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching teams over quota:', error)
    return NextResponse.json([])
  }
}

