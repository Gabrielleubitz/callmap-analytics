/**
 * Zod validation schemas for API request/response validation
 * 
 * These schemas ensure data integrity when transforming Firestore data
 * and validating user inputs.
 */

import { z } from 'zod'
import {
  Plan,
  UserRole,
  UserStatus,
  SessionSourceType,
  SessionStatus,
  AIJobType,
  AIJobStatus,
  SubscriptionStatus,
  InvoiceStatus,
  CreditType,
} from './types'

// Base schemas
export const planSchema = z.enum(['free', 'pro', 'team', 'enterprise'])
export const userRoleSchema = z.enum(['owner', 'admin', 'member'])
export const userStatusSchema = z.enum(['active', 'invited', 'disabled'])
export const sessionSourceTypeSchema = z.enum(['call', 'meeting', 'upload', 'url'])
export const sessionStatusSchema = z.enum(['queued', 'processing', 'ready', 'failed'])
export const aiJobTypeSchema = z.enum(['transcribe', 'summarize', 'map', 'export'])
export const aiJobStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed'])
export const subscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'canceled'])
export const invoiceStatusSchema = z.enum(['draft', 'open', 'paid', 'void'])
export const creditTypeSchema = z.enum(['promo', 'support', 'manual'])

// Date schema - accepts ISO string or Date, converts to Date
export const dateSchema = z.union([
  z.string().datetime(),
  z.date(),
]).transform((val) => val instanceof Date ? val : new Date(val))

// Nullable date schema
export const nullableDateSchema = z.union([
  z.string().datetime(),
  z.date(),
  z.null(),
]).transform((val) => val === null ? null : (val instanceof Date ? val : new Date(val)))

// Entity schemas
export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: planSchema,
  created_at: dateSchema,
  owner_user_id: z.string(),
  country: z.string().nullable(),
  is_active: z.boolean(),
})

export const userSchema = z.object({
  id: z.string(),
  team_id: z.string().nullable(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  created_at: dateSchema,
  last_login_at: nullableDateSchema,
  last_activity_at: nullableDateSchema,
  audioMinutesUsed: z.number().int().nonnegative().optional(),
  mapsGenerated: z.number().int().nonnegative().optional(),
  monthlyResetTimestamp: nullableDateSchema.optional(),
  onboarded: z.boolean().optional(),
  plan: planSchema.optional(),
  tokenBalance: z.number().int().nonnegative().optional(),
  updatedAt: nullableDateSchema.optional(),
})

export const sessionSchema = z.object({
  id: z.string(),
  team_id: z.string().nullable(),
  user_id: z.string().nullable(),
  source_type: sessionSourceTypeSchema,
  status: sessionStatusSchema,
  duration_seconds: z.number().int().nonnegative().nullable(),
  chars_in: z.number().int().nonnegative().nullable(),
  tokens_in: z.number().int().nonnegative().nullable(),
  tokens_out: z.number().int().nonnegative().nullable(),
  model: z.string().nullable(),
  cost_usd: z.number().nonnegative().nullable(),
  created_at: dateSchema,
})

export const aiJobSchema = z.object({
  id: z.string(),
  session_id: z.string().nullable(),
  type: aiJobTypeSchema,
  status: aiJobStatusSchema,
  started_at: nullableDateSchema,
  finished_at: nullableDateSchema,
  tokens_in: z.number().int().nonnegative().nullable(),
  tokens_out: z.number().int().nonnegative().nullable(),
  cost_usd: z.number().nonnegative().nullable(),
  error_message: z.string().nullable(),
})

export const subscriptionSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  plan: planSchema,
  provider: z.string(),
  status: subscriptionStatusSchema,
  trial_end: nullableDateSchema,
  current_period_start: dateSchema,
  current_period_end: dateSchema,
  cancel_at: nullableDateSchema,
  canceled_at: nullableDateSchema,
})

export const invoiceSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  amount_usd: z.number().nonnegative(),
  status: invoiceStatusSchema,
  due_date: dateSchema,
  paid_at: nullableDateSchema,
  period_start: dateSchema,
  period_end: dateSchema,
})

export const paymentSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  amount_usd: z.number().nonnegative(),
  provider: z.string(),
  provider_charge_id: z.string().nullable(),
  created_at: dateSchema,
})

export const creditSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  type: creditTypeSchema,
  amount_usd: z.number().nonnegative(),
  created_at: dateSchema,
  expires_at: nullableDateSchema,
})

// Request/Response schemas
export const dateRangeSchema = z.object({
  start: z.union([z.string().datetime(), z.date()]).transform((val) => val instanceof Date ? val : new Date(val)),
  end: z.union([z.string().datetime(), z.date()]).transform((val) => val instanceof Date ? val : new Date(val)),
})

export const paginationParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  plan: planSchema.optional(),
  onboarded: z.boolean().optional(),
  tokenBalance: z.number().int().nonnegative().optional(),
  audioMinutesUsed: z.number().int().nonnegative().optional(),
  mapsGenerated: z.number().int().nonnegative().optional(),
  monthlyResetTimestamp: z.string().datetime().optional(),
}).strict() // Reject unknown fields

// Response schemas
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
  })

export const overviewMetricsSchema = z.object({
  total_users: z.number().int().nonnegative(),
  active_users: z.number().int().nonnegative(),
  new_registrations: z.number().int().nonnegative(),
  active_teams: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
  estimated_cost: z.number().nonnegative(),
  mrr_estimate: z.number().nonnegative(),
})

export const usageMetricsSchema = z.object({
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
  tokensByModel: z.array(z.object({
    model: z.string(),
    tokens: z.number().int().nonnegative(),
  })),
  avgTokensPerSession: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
})

export const billingMetricsSchema = z.object({
  mrr: z.number().nonnegative(),
  totalRevenue: z.number().nonnegative(),
  unpaidInvoices: z.number().nonnegative(),
  payingTeams: z.number().int().nonnegative(),
})

export const aiJobStatsSchema = z.object({
  failureRate: z.number().nonnegative().max(100),
  longestRunningJob: z.number().int().nonnegative(),
  avgDurationByType: z.array(z.object({
    type: aiJobTypeSchema,
    duration: z.number().nonnegative(),
  })),
})

