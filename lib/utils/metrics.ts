/**
 * Shared metric calculation utilities
 * 
 * Centralizes formulas for tokens, costs, and other metrics to ensure
 * consistency across all pages and prevent double-counting.
 */

import { Session, AIJob } from '../types'

/**
 * Calculate total tokens from a session (tokens_in + tokens_out)
 */
export function getSessionTotalTokens(session: Session): number {
  return (session.tokens_in || 0) + (session.tokens_out || 0)
}

/**
 * Calculate total tokens from an AI job (tokens_in + tokens_out)
 */
export function getJobTotalTokens(job: AIJob): number {
  return (job.tokens_in || 0) + (job.tokens_out || 0)
}

/**
 * Calculate total cost from a session
 */
export function getSessionCost(session: Session): number {
  return session.cost_usd || 0
}

/**
 * Calculate total cost from an AI job
 */
export function getJobCost(job: AIJob): number {
  return job.cost_usd || 0
}

/**
 * Aggregate tokens from multiple sessions
 * Returns: { tokensIn, tokensOut, totalTokens, cost }
 */
export function aggregateSessionTokens(sessions: Session[]): {
  tokensIn: number
  tokensOut: number
  totalTokens: number
  cost: number
} {
  let tokensIn = 0
  let tokensOut = 0
  let cost = 0

  for (const session of sessions) {
    tokensIn += session.tokens_in || 0
    tokensOut += session.tokens_out || 0
    cost += session.cost_usd || 0
  }

  return {
    tokensIn,
    tokensOut,
    totalTokens: tokensIn + tokensOut,
    cost,
  }
}

/**
 * Aggregate tokens from multiple AI jobs
 * Returns: { tokensIn, tokensOut, totalTokens, cost }
 */
export function aggregateJobTokens(jobs: AIJob[]): {
  tokensIn: number
  tokensOut: number
  totalTokens: number
  cost: number
} {
  let tokensIn = 0
  let tokensOut = 0
  let cost = 0

  for (const job of jobs) {
    tokensIn += job.tokens_in || 0
    tokensOut += job.tokens_out || 0
    cost += job.cost_usd || 0
  }

  return {
    tokensIn,
    tokensOut,
    totalTokens: tokensIn + tokensOut,
    cost,
  }
}

/**
 * Group tokens by model from sessions
 * Returns a map of model -> total tokens
 */
export function groupTokensByModel(sessions: Session[]): Map<string, number> {
  const modelMap = new Map<string, number>()

  for (const session of sessions) {
    if (session.model) {
      const tokens = getSessionTotalTokens(session)
      modelMap.set(session.model, (modelMap.get(session.model) || 0) + tokens)
    }
  }

  return modelMap
}

/**
 * Group tokens by model from AI jobs
 * Returns a map of model -> total tokens
 */
export function groupJobTokensByModel(jobs: AIJob[]): Map<string, number> {
  const modelMap = new Map<string, number>()

  for (const job of jobs) {
    // Note: AI jobs may not have a model field directly
    // This is a placeholder - adjust based on actual data structure
    const model = 'unknown' // TODO: Get from job if available
    const tokens = getJobTotalTokens(job)
    modelMap.set(model, (modelMap.get(model) || 0) + tokens)
  }

  return modelMap
}

/**
 * Calculate average tokens per session
 */
export function calculateAvgTokensPerSession(
  totalTokens: number,
  sessionCount: number
): number {
  return sessionCount > 0 ? totalTokens / sessionCount : 0
}

/**
 * Calculate percentage of quota used
 * 
 * Formula: (used / quota) * 100
 * Returns 0 if quota is 0 to avoid division by zero
 */
export function calculateQuotaPercentage(used: number, quota: number): number {
  return quota > 0 ? (used / quota) * 100 : 0
}

