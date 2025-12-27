/**
 * Configuration constants for Callmap Analytics
 * 
 * Centralizes business logic constants like plan prices, quotas, etc.
 * This ensures consistency across all calculations.
 */

import { Plan } from './types'

/**
 * Monthly recurring revenue (MRR) for each plan tier
 * Used for MRR calculations and revenue estimates
 */
export const PLAN_PRICES: Record<Plan, number> = {
  free: 0,
  pro: 29,
  team: 99,
  enterprise: 299,
}

/**
 * Monthly token quotas for each plan tier
 * Used for quota calculations and over-quota detection
 */
export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 10000,
  pro: 100000,
  team: 500000,
  enterprise: 10000000,
}

/**
 * Firestore collection name mappings
 * Maps our internal collection names to actual Firestore collection names
 */
export const FIRESTORE_COLLECTIONS = {
  teams: 'workspaces',
  users: 'users',
  tokenWallets: 'tokenWallets',
  sessions: 'mindmaps',
  aiJobs: 'processingJobs',
  subscriptions: 'subscriptions',
  invoices: 'invoices',
  payments: 'payments',
  credits: 'credits',
  featureFlags: 'featureFlags',
  featureFlagOverrides: 'featureFlagOverrides',
  apiKeys: 'apiKeys',
  webhookEndpoints: 'webhookEndpoints',
  webhookLogs: 'webhookLogs',
  auditLogs: 'auditLogs',
  usage: 'usage', // Subcollection under users
  supportErrors: 'support_error_events',
  supportErrorTriage: 'support_error_triage',
  supportErrorKB: 'support_error_kb',
  customDashboards: 'customDashboards',
  alertRules: 'alertRules',
  insights: 'insights',
  predictions: 'predictions',
  reports: 'reports',
} as const

/**
 * Get MRR for a given plan
 */
export function getPlanMRR(plan: Plan): number {
  return PLAN_PRICES[plan] || 0
}

/**
 * Get quota for a given plan
 */
export function getPlanQuota(plan: Plan): number {
  return PLAN_QUOTAS[plan] || 0
}

/**
 * Check if a plan is a paying plan (not free)
 */
export function isPayingPlan(plan: Plan): boolean {
  return plan !== 'free'
}

