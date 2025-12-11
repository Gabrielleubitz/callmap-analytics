/**
 * Token and cost calculation utilities
 * 
 * Centralizes all token and cost calculations to ensure consistency.
 * All routes should use these functions instead of calculating inline.
 */

import * as admin from 'firebase-admin'
import { FIRESTORE_COLLECTIONS } from '../config'
import { toDate, toFirestoreTimestamp } from './date'
import { adminDb } from '../firebase-admin'

/**
 * Token usage data from a single source
 */
export interface TokenUsage {
  tokensIn: number
  tokensOut: number
  cost: number
  model?: string
}

/**
 * Aggregate token usage from multiple sources
 */
export interface AggregatedTokenUsage {
  tokensIn: number
  tokensOut: number
  totalTokens: number
  cost: number
  byModel: Map<string, number>
}

/**
 * Calculate total tokens from tokensIn and tokensOut
 * 
 * Formula: tokensIn + tokensOut
 * Used consistently across all token calculations
 */
export function calculateTotalTokens(tokensIn: number, tokensOut: number): number {
  return tokensIn + tokensOut
}

/**
 * Extract token usage from a processing job document
 * Fields: tokensIn, tokensOut, costUsd (or cost), model
 */
export function extractTokenUsageFromJob(jobData: any): TokenUsage {
  return {
    tokensIn: jobData.tokensIn || 0,
    tokensOut: jobData.tokensOut || 0,
    cost: jobData.costUsd || jobData.cost || 0,
    model: jobData.model || 'unknown',
  }
}

/**
 * Extract token usage from a usage/month document
 * Fields: promptTokens, completionTokens, model
 */
export function extractTokenUsageFromUsageMonth(monthData: any): TokenUsage {
  return {
    tokensIn: monthData.promptTokens || 0,
    tokensOut: monthData.completionTokens || 0,
    cost: 0, // Usage collection doesn't track cost
    model: monthData.model || 'unknown',
  }
}

/**
 * Aggregate multiple token usage records
 */
export function aggregateTokenUsage(usages: TokenUsage[]): AggregatedTokenUsage {
  let tokensIn = 0
  let tokensOut = 0
  let cost = 0
  const byModel = new Map<string, number>()

  for (const usage of usages) {
    tokensIn += usage.tokensIn
    tokensOut += usage.tokensOut
    cost += usage.cost
    
    const model = usage.model || 'unknown'
    const total = calculateTotalTokens(usage.tokensIn, usage.tokensOut)
    byModel.set(model, (byModel.get(model) || 0) + total)
  }

  return {
    tokensIn,
    tokensOut,
    totalTokens: calculateTotalTokens(tokensIn, tokensOut),
    cost,
    byModel,
  }
}

/**
 * Get token usage from processingJobs collection within a date range
 * 
 * This is the PRIMARY source of truth for tokens and costs.
 * Fields used: processingJobs.tokensIn, processingJobs.tokensOut, processingJobs.costUsd, processingJobs.createdAt
 */
export async function getTokenUsageFromJobs(
  start: Date,
  end: Date
): Promise<AggregatedTokenUsage> {
  if (!adminDb) {
    return { tokensIn: 0, tokensOut: 0, totalTokens: 0, cost: 0, byModel: new Map() }
  }
  const db = adminDb
  const startTimestamp = toFirestoreTimestamp(start)
  const endTimestamp = toFirestoreTimestamp(end)

  let jobsSnapshot
  try {
    jobsSnapshot = await db
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
  } catch (error) {
    // Fallback: Get all and filter client-side if index missing
    console.warn('[Tokens] Missing index for processingJobs.createdAt query, using fallback')
    const allJobs = await db.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
    jobsSnapshot = {
      docs: allJobs.docs.filter((doc) => {
        const createdAt = toDate(doc.data().createdAt)
        return createdAt && createdAt >= start && createdAt <= end
      }),
    } as any
  }

  const usages: TokenUsage[] = []
  for (const doc of jobsSnapshot.docs) {
    usages.push(extractTokenUsageFromJob(doc.data()))
  }

  return aggregateTokenUsage(usages)
}

/**
 * Get token usage for a specific team within a date range
 * 
 * Formula: Sum of tokens from processingJobs where workspaceId matches teamId
 */
export async function getTeamTokenUsage(
  teamId: string,
  start: Date,
  end: Date
): Promise<AggregatedTokenUsage> {
  if (!adminDb) {
    return { tokensIn: 0, tokensOut: 0, totalTokens: 0, cost: 0, byModel: new Map() }
  }
  const db = adminDb
  const startTimestamp = toFirestoreTimestamp(start)
  const endTimestamp = toFirestoreTimestamp(end)

  let jobsSnapshot
  try {
    jobsSnapshot = await db
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('workspaceId', '==', teamId)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
  } catch (error) {
    // Fallback: Get all and filter
    console.warn('[Tokens] Missing index for team token usage query, using fallback')
    const allJobs = await db.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
    jobsSnapshot = {
      docs: allJobs.docs.filter((doc) => {
        const data = doc.data()
        const workspaceId = data.workspaceId || data.teamId
        const createdAt = toDate(data.createdAt)
        return workspaceId === teamId && createdAt && createdAt >= start && createdAt <= end
      }),
    } as any
  }

  const usages: TokenUsage[] = []
  for (const doc of jobsSnapshot.docs) {
    usages.push(extractTokenUsageFromJob(doc.data()))
  }

  return aggregateTokenUsage(usages)
}

/**
 * Get token usage for current month for a team
 * Used for quota calculations
 */
export async function getTeamCurrentMonthUsage(teamId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const usage = await getTeamTokenUsage(teamId, startOfMonth, endOfMonth)
  return usage.totalTokens
}

/**
 * Group token usage by date (for daily charts)
 * Returns map of date string (YYYY-MM-DD) -> total tokens
 */
export async function getDailyTokenUsage(
  start: Date,
  end: Date
): Promise<Map<string, number>> {
  if (!adminDb) return new Map<string, number>()
  const db = adminDb
  const startTimestamp = toFirestoreTimestamp(start)
  const endTimestamp = toFirestoreTimestamp(end)

  let jobsSnapshot
  try {
    jobsSnapshot = await db
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
  } catch (error) {
    // Fallback
    console.warn('[Tokens] Missing index for daily token usage query, using fallback')
    const allJobs = await db.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
    jobsSnapshot = {
      docs: allJobs.docs.filter((doc) => {
        const createdAt = toDate(doc.data().createdAt)
        return createdAt && createdAt >= start && createdAt <= end
      }),
    } as any
  }

  const dailyData = new Map<string, number>()
  for (const doc of jobsSnapshot.docs) {
    const data = doc.data()
    const createdAt = toDate(data.createdAt)
    if (createdAt) {
      const dateKey = createdAt.toISOString().split('T')[0]
      const usage = extractTokenUsageFromJob(data)
      const total = calculateTotalTokens(usage.tokensIn, usage.tokensOut)
      dailyData.set(dateKey, (dailyData.get(dateKey) || 0) + total)
    }
  }

  return dailyData
}

/**
 * Group token usage by model and date (for model breakdown charts)
 * Returns map of date -> map of model -> tokens
 */
export async function getDailyTokenUsageByModel(
  start: Date,
  end: Date
): Promise<Map<string, Map<string, number>>> {
  if (!adminDb) return new Map<string, Map<string, number>>()
  const db = adminDb
  const startTimestamp = toFirestoreTimestamp(start)
  const endTimestamp = toFirestoreTimestamp(end)

  let jobsSnapshot
  try {
    jobsSnapshot = await db
      .collection(FIRESTORE_COLLECTIONS.aiJobs)
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get()
  } catch (error) {
    // Fallback
    console.warn('[Tokens] Missing index for daily token usage by model query, using fallback')
    const allJobs = await db.collection(FIRESTORE_COLLECTIONS.aiJobs).get()
    jobsSnapshot = {
      docs: allJobs.docs.filter((doc) => {
        const createdAt = toDate(doc.data().createdAt)
        return createdAt && createdAt >= start && createdAt <= end
      }),
    } as any
  }

  const dailyModelData = new Map<string, Map<string, number>>()
  for (const doc of jobsSnapshot.docs) {
    const data = doc.data()
    const createdAt = toDate(data.createdAt)
    if (createdAt) {
      const dateKey = createdAt.toISOString().split('T')[0]
      const usage = extractTokenUsageFromJob(data)
      const model = usage.model || 'unknown'
      const total = calculateTotalTokens(usage.tokensIn, usage.tokensOut)

      if (!dailyModelData.has(dateKey)) {
        dailyModelData.set(dateKey, new Map())
      }
      const modelMap = dailyModelData.get(dateKey)!
      modelMap.set(model, (modelMap.get(model) || 0) + total)
    }
  }

  return dailyModelData
}

