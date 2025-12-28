/**
 * Input Validation Schemas
 * 
 * SECURITY: Centralized Zod schemas for validating all API inputs
 * Prevents injection attacks, type confusion, and invalid data
 */

import { z } from 'zod'

// Common validation patterns
export const emailSchema = z.string().email().max(255)
export const uidSchema = z.string().min(1).max(128)
export const nonEmptyStringSchema = z.string().min(1).max(10000)
export const positiveIntSchema = z.number().int().positive()
export const nonNegativeIntSchema = z.number().int().nonnegative()
export const dateStringSchema = z.string().datetime()

// Pagination
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
  pageSize: z.number().int().positive().max(100).default(20).optional(),
  limit: z.number().int().positive().max(1000).optional(),
})

// Date range
export const dateRangeSchema = z.object({
  start: dateStringSchema.optional(),
  end: dateStringSchema.optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
})

// AI Agent schemas
export const agentTypeSchema = z.enum(['product', 'dev'])
export const agentIdSchema = z.enum(['marketing', 'support', 'product', 'revenue', 'ops'])
export const toneSchema = z.enum(['normal', 'brutal'])

export const aiAgentRequestSchema = z.object({
  message: nonEmptyStringSchema.max(5000), // Limit message length
  agentType: agentTypeSchema.optional(),
  agents: z.array(agentIdSchema).optional(),
  tone: toneSchema.optional(),
  history: z.any().optional(), // Complex type, validate separately if needed
}).strict()

export const generatePromptRequestSchema = z.object({
  agentType: agentTypeSchema,
  question: nonEmptyStringSchema.max(2000),
  answer: nonEmptyStringSchema.max(10000),
  tags: z.array(z.string()).optional(),
  context: z.record(z.any()).optional(),
}).strict()

// Dashboard schemas
export const dashboardCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  widgets: z.array(z.any()).optional(),
  layout: z.any().optional(),
}).strict()

export const dashboardUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  widgets: z.array(z.any()).optional(),
  layout: z.any().optional(),
}).strict()

// Report schemas
export const reportGenerateSchema = z.object({
  type: z.string().min(1).max(100),
  dateRange: dateRangeSchema.optional(),
  format: z.enum(['json', 'pdf', 'excel', 'csv']).default('json'),
}).strict()

// Wallet adjustment schema
export const walletAdjustSchema = z.object({
  amount: z.number().int(), // Can be negative
  note: z.string().max(500).optional(),
  csrfToken: z.string().optional(),
}).strict()

// User update schema (already exists in lib/schemas.ts, but adding here for completeness)
export const userUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: emailSchema.optional(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']).optional(),
  tokenBalance: nonNegativeIntSchema.optional(),
}).strict()

// Role change schema
export const setRoleSchema = z.object({
  uid: uidSchema,
  role: z.enum(['admin', 'superAdmin']),
}).strict()

// Support error schemas
export const supportErrorListSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
  pageSize: z.number().int().positive().max(100).default(20).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  expected: z.boolean().optional(),
  critical: z.boolean().optional(),
  appArea: z.string().max(100).optional(),
  userId: uidSchema.optional(),
  workspaceId: uidSchema.optional(),
  triageStatus: z.enum(['pending', 'processing', 'done', 'ignored', 'escalated']).optional(),
}).strict()

export const supportErrorUpdateSchema = z.object({
  triageStatus: z.enum(['pending', 'processing', 'done', 'ignored', 'escalated']).optional(),
  acknowledgedAt: dateStringSchema.optional(),
  resolvedAt: dateStringSchema.optional(),
  resolutionType: z.enum(['user_action', 'engineering_fix', 'config_change', 'ignored']).optional(),
  resolutionNotes: z.string().max(2000).optional(),
}).strict()

// AI explain page schema
export const explainPageSchema = z.object({
  pageName: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  metrics: z.record(z.any()).optional(),
  data: z.any().optional(),
}).strict()

// Insights schema
export const insightsGenerateSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
}).strict()

// Copilot schema
export const copilotRequestSchema = z.object({
  message: nonEmptyStringSchema.max(5000),
}).strict()

/**
 * Validate request body with a schema
 * Returns validated data or throws validation error
 */
export function validateRequestBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body)
}

/**
 * Validate request body safely (returns result instead of throwing)
 */
export function safeValidateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): T {
  const params: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    params[key] = value
  }
  return schema.parse(params)
}

