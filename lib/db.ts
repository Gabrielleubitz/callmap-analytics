/**
 * Database functions for Callmap Analytics
 * 
 * Data Flow:
 * 1. Frontend pages call functions from this file (lib/db.ts)
 * 2. These functions make HTTP requests to Next.js API routes (/app/api/**)
 * 3. API routes use Firebase Admin SDK to query Firestore directly
 * 4. API routes return validated, typed data
 * 5. Frontend receives and displays the data
 * 
 * This architecture:
 * - Avoids CORS issues (same-origin API routes)
 * - Keeps Firebase credentials server-side only
 * - Allows server-side validation and transformation
 * - Provides consistent error handling
 */

// Use Next.js API routes (server-side, no CORS issues)
const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3000'

/**
 * Make an API request and return the response
 * Handles standardized response shapes (PaginatedResponse, MetricResponse, ErrorResponse)
 */
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error')
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      console.error(`[API] ${endpoint} failed (${response.status}):`, errorData)
      return null
    }
    
    const json = await response.json()
    return json
  } catch (error) {
    console.error(`[API] ${endpoint} error:`, error)
    return null
  }
}

/**
 * Extract data from MetricResponse<T>
 * Returns the data field, or null if response is invalid
 */
function extractMetricData<T>(response: { data: T } | null): T | null {
  return response?.data ?? null
}

/**
 * Extract items from PaginatedResponse<T>
 * Returns { items, total } for backward compatibility
 */
function extractPaginatedData<T>(response: { items: T[]; total: number } | null): { data: T[]; total: number } {
  if (!response) {
    return { data: [], total: 0 }
  }
  return {
    data: response.items || [],
    total: response.total || 0,
  }
}

// Import types for use in function parameters
import type {
  DateRange,
  Plan,
  OverviewMetrics,
  UsageMetrics,
  BillingMetrics,
  AIJobStats,
  Team,
  User,
  Session,
  AIJob,
  SessionSourceType,
  TeamsParams,
  UsersParams,
  PaginationParams,
  Subscription,
  Invoice,
  Payment,
  Credit,
  FeatureFlagOverride,
  APIKey,
  WebhookEndpoint,
  AuditLog,
  SessionStatus,
  SubscriptionStatus,
  InvoiceStatus,
  CreditType,
  AIJobType,
  AIJobStatus,
  WebhookLog,
  PaginatedResponse,
} from './types'
import type { MetricResponse } from './utils/api-response'

// Re-export types from central types file
export type {
  DateRange,
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
  Team,
  User,
  TokenWallet,
  Session,
  AIJob,
  Subscription,
  Invoice,
  Payment,
  Credit,
  FeatureFlag,
  FeatureFlagOverride,
  APIKey,
  WebhookEndpoint,
  WebhookLog,
  AuditLog,
  OverviewMetrics,
  UsageMetrics,
  BillingMetrics,
  AIJobStats,
  PaginationParams,
  TeamsParams,
  UsersParams,
  UserUpdatePayload,
  PaginatedResponse,
} from './types'

// Database functions - fetch from Next.js API routes (server-side Firebase Admin)

export async function getOverviewMetrics(range: DateRange): Promise<OverviewMetrics> {
  const result = await apiRequest<{ data: OverviewMetrics }>('/api/analytics/overview', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  
  // Extract data from MetricResponse shape
  const metrics = extractMetricData(result)
  if (metrics) return metrics
  
  // Return default values if API call failed
  return {
    total_users: 0,
    active_users: 0,
    new_registrations: 0,
    active_teams: 0,
    sessions: 0,
    tokens_used: 0,
    estimated_cost: 0,
    mrr_estimate: 0,
  }
}

export async function getDailyActiveUsers(range: DateRange): Promise<Array<{ date: string; active: number; new: number }>> {
  const result = await apiRequest<Array<{ date: string; active: number; new: number }>>('/api/analytics/daily-active-users', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getDailySessions(range: DateRange): Promise<Array<{ date: string; count: number }>> {
  const result = await apiRequest<Array<{ date: string; count: number }>>('/api/analytics/daily-sessions', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getDailyTokensByModel(range: DateRange): Promise<Array<{ date: string; model: string; tokens: number }>> {
  const result = await apiRequest<Array<{ date: string; model: string; tokens: number }>>('/api/analytics/daily-tokens-by-model', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getTokensByPlan(range: DateRange): Promise<Array<{ plan: Plan; tokens: number }>> {
  const result = await apiRequest<Array<{ plan: Plan; tokens: number }>>('/api/analytics/tokens-by-plan', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getTopTeamsByTokens(range: DateRange, limitCount: number = 10): Promise<Array<{ team_id: string; team_name: string; tokens: number }>> {
  const result = await apiRequest<Array<{ team_id: string; team_name: string; tokens: number }>>('/api/analytics/top-teams-by-tokens', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      limit: limitCount,
    }),
  })
  return result || []
}

export async function getTopTeamsByCost(range: DateRange, limitCount: number = 10): Promise<Array<{ team_id: string; team_name: string; cost: number }>> {
  const result = await apiRequest<Array<{ team_id: string; team_name: string; cost: number }>>('/api/analytics/top-teams-by-cost', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      limit: limitCount,
    }),
  })
  return result || []
}

export async function getRecentlyCreatedTeams(limitCount: number = 10): Promise<Team[]> {
  const result = await apiRequest<Team[]>('/api/analytics/recent-teams', {
    method: 'POST',
    body: JSON.stringify({ limit: limitCount }),
  })
  return result || []
}

export async function getRecentlyFailedAIJobs(limitCount: number = 10): Promise<AIJob[]> {
  const result = await apiRequest<AIJob[]>('/api/analytics/recent-failed-jobs', {
    method: 'POST',
    body: JSON.stringify({ limit: limitCount }),
  })
  return result || []
}

export async function getTeams(params: TeamsParams): Promise<{ data: Team[]; total: number }> {
  const result = await apiRequest<{ items: Team[]; total: number; page: number; pageSize: number }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return extractPaginatedData(result)
}

export async function getTeamDetail(teamId: string, range: DateRange): Promise<Team | null> {
  const result = await apiRequest<Team>(`/api/teams/${teamId}`, {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || null
}

export async function getTeamUsers(teamId: string, params: PaginationParams): Promise<{ data: User[]; total: number }> {
  const result = await apiRequest<{ data: User[]; total: number }>(`/api/teams/${teamId}/users`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getTeamSessions(teamId: string, params: PaginationParams): Promise<{ data: Session[]; total: number }> {
  const result = await apiRequest<{ data: Session[]; total: number }>(`/api/teams/${teamId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getTeamBilling(teamId: string): Promise<{
  subscriptions: Subscription[]
  invoices: Invoice[]
  payments: Payment[]
  credits: Credit[]
}> {
  const result = await apiRequest<{
    subscriptions: Subscription[]
    invoices: Invoice[]
    payments: Payment[]
    credits: Credit[]
  }>(`/api/teams/${teamId}/billing`, {
    method: 'POST',
  })
  return result || {
    subscriptions: [],
    invoices: [],
    payments: [],
    credits: [],
  }
}

export async function getTeamAPI(teamId: string): Promise<{
  apiKeys: APIKey[]
  webhookEndpoints: WebhookEndpoint[]
}> {
  const result = await apiRequest<{
    apiKeys: APIKey[]
    webhookEndpoints: WebhookEndpoint[]
  }>(`/api/teams/${teamId}/api`, {
    method: 'POST',
  })
  return result || {
    apiKeys: [],
    webhookEndpoints: [],
  }
}

export async function getTeamAuditLogs(teamId: string, params: PaginationParams): Promise<{ data: AuditLog[]; total: number }> {
  const result = await apiRequest<{ data: AuditLog[]; total: number }>(`/api/teams/${teamId}/audit-logs`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getUsers(params: UsersParams): Promise<{ data: User[]; total: number }> {
  const result = await apiRequest<{ items: User[]; total: number; page: number; pageSize: number }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return extractPaginatedData(result)
}

export async function getUserDetail(userId: string): Promise<User | null> {
  const result = await apiRequest<User>(`/api/users/${userId}`, {
    method: 'POST',
  })
  return result || null
}

export async function getUserSessions(userId: string, params: PaginationParams): Promise<{ data: Session[]; total: number }> {
  const result = await apiRequest<{ data: Session[]; total: number }>(`/api/users/${userId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getUserAuditLogs(userId: string, params: PaginationParams): Promise<{ data: AuditLog[]; total: number }> {
  const result = await apiRequest<{ data: AuditLog[]; total: number }>(`/api/users/${userId}/audit-logs`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getUserFeatureFlags(userId: string): Promise<FeatureFlagOverride[]> {
  const result = await apiRequest<FeatureFlagOverride[]>(`/api/users/${userId}/feature-flags`, {
    method: 'POST',
  })
  return result || []
}

export async function getUsageMetrics(range: DateRange): Promise<{
  totalTokensIn: number
  totalTokensOut: number
  tokensByModel: Array<{ model: string; tokens: number }>
  avgTokensPerSession: number
  totalCost: number
}> {
  const result = await apiRequest<{ data: {
    totalTokensIn: number
    totalTokensOut: number
    tokensByModel: Array<{ model: string; tokens: number }>
    avgTokensPerSession: number
    totalCost: number
  }; meta?: any }>('/api/usage/metrics', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result) || {
    totalTokensIn: 0,
    totalTokensOut: 0,
    tokensByModel: [],
    avgTokensPerSession: 0,
    totalCost: 0,
  }
}

export async function getDailyTokens(range: DateRange): Promise<Array<{ date: string; tokens: number }>> {
  const result = await apiRequest<Array<{ date: string; tokens: number }>>('/api/usage/daily-tokens', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getTokensBySourceType(range: DateRange): Promise<Array<{ source_type: SessionSourceType; tokens: number }>> {
  const result = await apiRequest<Array<{ source_type: SessionSourceType; tokens: number }>>('/api/usage/tokens-by-source', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getSessions(params: PaginationParams & {
  teamId?: string
  model?: string
  sourceType?: SessionSourceType
  status?: SessionStatus
}): Promise<{ data: Session[]; total: number }> {
  const result = await apiRequest<{ data: Session[]; total: number }>('/api/usage/sessions', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getMostExpensiveSessions(range: DateRange, limit: number = 10): Promise<Session[]> {
  const result = await apiRequest<Session[]>('/api/usage/expensive-sessions', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      limit,
    }),
  })
  return result || []
}

export async function getTeamsOverQuota(): Promise<Array<{ team_id: string; team_name: string; quota: number; used: number; percentage: number }>> {
  const result = await apiRequest<Array<{ team_id: string; team_name: string; quota: number; used: number; percentage: number }>>('/api/usage/teams-over-quota', {
    method: 'POST',
  })
  return result || []
}

export async function getBillingMetrics(range: DateRange): Promise<{
  mrr: number
  totalRevenue: number
  unpaidInvoices: number
  payingTeams: number
}> {
  const result = await apiRequest<{ data: {
    mrr: number
    totalRevenue: number
    unpaidInvoices: number
    payingTeams: number
  }; meta?: any }>('/api/billing/metrics', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result) || {
    mrr: 0,
    totalRevenue: 0,
    unpaidInvoices: 0,
    payingTeams: 0,
  }
}

export async function getRevenueOverTime(range: DateRange): Promise<Array<{ date: string; revenue: number }>> {
  const result = await apiRequest<Array<{ date: string; revenue: number }>>('/api/billing/revenue-over-time', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getRevenueByPlan(range: DateRange): Promise<Array<{ plan: Plan; revenue: number }>> {
  const result = await apiRequest<Array<{ plan: Plan; revenue: number }>>('/api/billing/revenue-by-plan', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getChurnByMonth(range: DateRange): Promise<Array<{ month: string; canceled: number }>> {
  const result = await apiRequest<Array<{ month: string; canceled: number }>>('/api/billing/churn', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || []
}

export async function getSubscriptions(params: PaginationParams & {
  plan?: Plan[]
  status?: SubscriptionStatus[]
}): Promise<{ data: Subscription[]; total: number }> {
  const result = await apiRequest<{ data: Subscription[]; total: number }>('/api/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getInvoices(params: PaginationParams & {
  teamId?: string
  status?: InvoiceStatus[]
}): Promise<{ data: Invoice[]; total: number }> {
  const result = await apiRequest<{ data: Invoice[]; total: number }>('/api/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getPayments(params: PaginationParams & {
  teamId?: string
}): Promise<{ data: Payment[]; total: number }> {
  const result = await apiRequest<{ data: Payment[]; total: number }>('/api/billing/payments', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getCredits(params: PaginationParams & {
  teamId?: string
  type?: CreditType[]
}): Promise<{ data: Credit[]; total: number }> {
  const result = await apiRequest<{ data: Credit[]; total: number }>('/api/billing/credits', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getAIJobs(params: PaginationParams & {
  type?: AIJobType[]
  status?: AIJobStatus[]
  teamId?: string
  start?: Date
  end?: Date
}): Promise<{ data: AIJob[]; total: number }> {
  const result = await apiRequest<{ data: AIJob[]; total: number }>('/api/ops/ai-jobs', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      start: params.start?.toISOString(),
      end: params.end?.toISOString(),
    }),
  })
  return result || { data: [], total: 0 }
}

export async function getAIJobStats(range: DateRange): Promise<{
  failureRate: number
  longestRunningJob: number
  avgDurationByType: Array<{ type: AIJobType; duration: number }>
}> {
  const result = await apiRequest<{
    failureRate: number
    longestRunningJob: number
    avgDurationByType: Array<{ type: AIJobType; duration: number }>
  }>('/api/ops/ai-job-stats', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || {
    failureRate: 0,
    longestRunningJob: 0,
    avgDurationByType: [],
  }
}

export async function getWebhookEndpoints(params: PaginationParams & {
  teamId?: string
}): Promise<{ data: WebhookEndpoint[]; total: number }> {
  const result = await apiRequest<{ data: WebhookEndpoint[]; total: number }>('/api/ops/webhook-endpoints', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getWebhookLogs(params: PaginationParams & {
  endpointId?: string
  statusCode?: number[]
  teamId?: string
}): Promise<{ data: WebhookLog[]; total: number }> {
  const result = await apiRequest<{ data: WebhookLog[]; total: number }>('/api/ops/webhook-logs', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
}

export async function getTableRows(
  tableName: string,
  params: PaginationParams & { search?: string; filters?: Record<string, any> }
): Promise<{ data: any[]; total: number; columns: string[] }> {
  const result = await apiRequest<{ data: any[]; total: number; columns: string[] }>('/api/explorer', {
    method: 'POST',
    body: JSON.stringify({
      tableName,
      ...params,
    }),
  })
  return result || { data: [], total: 0, columns: [] }
}

// New Analytics Metrics Functions

export async function getMindmapGenerationTime(range: DateRange): Promise<{
  totalMindmaps: number
  avgGenerationTimeMs: number
  medianGenerationTimeMs: number
  p95GenerationTimeMs: number
  minGenerationTimeMs: number
  maxGenerationTimeMs: number
  avgBySourceType: Record<string, number>
} | null> {
  const result = await apiRequest<{ data: {
    totalMindmaps: number
    avgGenerationTimeMs: number
    medianGenerationTimeMs: number
    p95GenerationTimeMs: number
    minGenerationTimeMs: number
    maxGenerationTimeMs: number
    avgBySourceType: Record<string, number>
  } }>('/api/analytics/mindmap-generation-time', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getMindmapEditCount(range: DateRange): Promise<{
  totalEdits: number
  mindmapsWithEdits: number
  avgEditsPerMindmap: number
  maxEdits: number
  byEditType: Record<string, number>
} | null> {
  const result = await apiRequest<{ data: {
    totalEdits: number
    mindmapsWithEdits: number
    avgEditsPerMindmap: number
    maxEdits: number
    byEditType: Record<string, number>
  } }>('/api/analytics/mindmap-edit-count', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getFileConversionRate(range: DateRange): Promise<{
  totalConversions: number
  successfulConversions: number
  failedConversions: number
  successRate: number
  byFileType: Record<string, { total: number; success: number; failed: number }>
  topErrors: Array<{ error: string; count: number }>
} | null> {
  const result = await apiRequest<{ data: {
    totalConversions: number
    successfulConversions: number
    failedConversions: number
    successRate: number
    byFileType: Record<string, { total: number; success: number; failed: number }>
    topErrors: Array<{ error: string; count: number }>
  } }>('/api/analytics/file-conversion-rate', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getUserRetention(range: DateRange): Promise<{
  totalUsers: number
  activeUsersThisPeriod: number
  weeklyRetention: Array<{
    week: string
    activeUsers: number
    retainedUsers: number
    newUsers: number
    retentionRate: number
  }>
} | null> {
  const result = await apiRequest<{ data: {
    totalUsers: number
    activeUsersThisPeriod: number
    weeklyRetention: Array<{
      week: string
      activeUsers: number
      retainedUsers: number
      newUsers: number
      retentionRate: number
    }>
  } }>('/api/analytics/user-retention', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getMindmapFunnel(range: DateRange): Promise<{
  stepCounts: Record<string, number>
  uniqueUsersByStep: Record<string, number>
  uniqueMindmapsByStep: Record<string, number>
  conversionRates: {
    uploadToProcess: number
    processToGenerate: number
    generateToView: number
    viewToEdit: number
    viewToExport: number
  }
} | null> {
  const result = await apiRequest<{ data: {
    stepCounts: Record<string, number>
    uniqueUsersByStep: Record<string, number>
    uniqueMindmapsByStep: Record<string, number>
    conversionRates: {
      uploadToProcess: number
      processToGenerate: number
      generateToView: number
      viewToEdit: number
      viewToExport: number
    }
  } }>('/api/analytics/mindmap-funnel', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getExportRate(range: DateRange): Promise<{
  totalExports: number
  successfulExports: number
  failedExports: number
  totalMindmaps: number
  exportedMindmaps: number
  exportRate: number
  byExportType: Record<string, { total: number; success: number; failed: number }>
  avgExportsPerMindmap: number
} | null> {
  const result = await apiRequest<{ data: {
    totalExports: number
    successfulExports: number
    failedExports: number
    totalMindmaps: number
    exportedMindmaps: number
    exportRate: number
    byExportType: Record<string, { total: number; success: number; failed: number }>
    avgExportsPerMindmap: number
  } }>('/api/analytics/export-rate', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getCollaborationActivity(range: DateRange): Promise<{
  totalCollaborationEvents: number
  byActivityType: Record<string, number>
  byWorkspace: Record<string, number>
  activeCollaborators: number
  activeMindmaps: number
  avgEventsPerMindmap: number
} | null> {
  const result = await apiRequest<{ data: {
    totalCollaborationEvents: number
    byActivityType: Record<string, number>
    byWorkspace: Record<string, number>
    activeCollaborators: number
    activeMindmaps: number
    avgEventsPerMindmap: number
  } }>('/api/analytics/collaboration-activity', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getTokenBurnByFeature(range: DateRange): Promise<{
  totalTokens: number
  totalEvents: number
  avgTokensPerEvent: number
  byFeature: Record<string, { total: number; count: number; avg: number }>
  byFeaturePercent: Record<string, number>
} | null> {
  const result = await apiRequest<{ data: {
    totalTokens: number
    totalEvents: number
    avgTokensPerEvent: number
    byFeature: Record<string, { total: number; count: number; avg: number }>
    byFeaturePercent: Record<string, number>
  } }>('/api/analytics/token-burn-by-feature', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

// Map Economics

export async function getMapEconomics(range: DateRange, filters?: {
  plan?: string
  teamId?: string
}): Promise<{
  teams: Array<{
    teamId: string
    teamName: string
    plan: string
    mrr: number
    totalTokenCost: number
    aiMargin: number
    mindmapsCount: number
    activeUsers: number
    costPerMindmap: number
    mapsPerActiveUser: number
  }>
  totals: {
    mrr: number
    tokenCost: number
    aiMargin: number
    mindmaps: number
  }
} | null> {
  const result = await apiRequest<{ data: {
    teams: Array<{
      teamId: string
      teamName: string
      plan: string
      mrr: number
      totalTokenCost: number
      aiMargin: number
      mindmapsCount: number
      activeUsers: number
      costPerMindmap: number
      mapsPerActiveUser: number
    }>
    totals: {
      mrr: number
      tokenCost: number
      aiMargin: number
      mindmaps: number
    }
  } }>('/api/analytics/map-economics', {
    method: 'POST',
    body: JSON.stringify({
      dateFrom: range.start.toISOString(),
      dateTo: range.end.toISOString(),
      ...filters,
    }),
  })
  return extractMetricData(result)
}

// Behavior Cohorts

export async function getBehaviorCohorts(range: DateRange, maxWeeks?: number): Promise<{
  cohorts: Array<{
    cohortKey: 'EXPORTERS_WEEK1' | 'EDITORS_3PLUS_WEEK1' | 'ONE_AND_DONE' | 'COLLABORATORS_WEEK1'
    size: number
    weeks: Array<{
      weekNumber: number
      activeUsers: number
      retentionRate: number
    }>
  }>
  generatedAt: string
} | null> {
  const result = await apiRequest<{ data: {
    cohorts: Array<{
      cohortKey: 'EXPORTERS_WEEK1' | 'EDITORS_3PLUS_WEEK1' | 'ONE_AND_DONE' | 'COLLABORATORS_WEEK1'
      size: number
      weeks: Array<{
        weekNumber: number
        activeUsers: number
        retentionRate: number
      }>
    }>
    generatedAt: string
  } }>('/api/analytics/behavior-cohorts', {
    method: 'POST',
    body: JSON.stringify({
      dateFrom: range.start.toISOString(),
      dateTo: range.end.toISOString(),
      maxWeeks,
    }),
  })
  return extractMetricData(result)
}

// New Features Analytics

export async function getActionItemsAnalytics(range: DateRange): Promise<any> {
  const result = await apiRequest<{ data: any }>('/api/analytics/action-items', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result) || {
    totalCreated: 0,
    totalCompleted: 0,
    completionRate: 0,
    addedToCalendar: 0,
    contactResolved: 0,
    byEventType: {},
    bySource: {},
    dailyCreated: [],
    dailyCompleted: [],
  }
}

export async function getCallLogsAnalytics(range: DateRange): Promise<any> {
  const result = await apiRequest<{ data: any }>('/api/analytics/call-logs', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result) || {
    totalWebhooks: 0,
    recordingsProcessed: 0,
    transcriptionsStarted: 0,
    transcriptionsCompleted: 0,
    mindmapsCreated: 0,
    byEventType: {},
    byProvider: {},
    dailyWebhooks: [],
    dailyRecordings: [],
  }
}

export async function getContactsAnalytics(range: DateRange): Promise<any> {
  const result = await apiRequest<{ data: any }>('/api/analytics/contacts', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result) || {
    totalSearches: 0,
    totalResolved: 0,
    totalActions: 0,
    totalEmailDrafts: 0,
    byEventType: {},
    dailySearches: [],
    dailyResolved: [],
  }
}

export async function getMindmapContentAnalytics(range: DateRange): Promise<{
  averageNodesPerMindmap: number
  totalNodes: number
  totalMindmaps: number
  tagDistribution: Array<{ tag: string; count: number }>
  mostActiveMindmaps: Array<{
    mindmapId: string
    title: string
    viewCount: number
    editCount: number
    exportCount: number
    createdAt: string
  }>
  distributionBySourceType: Array<{ sourceType: string; count: number }>
  distributionByWorkspace: Array<{ workspaceId: string | null; count: number }>
} | null> {
  const result = await apiRequest<{ data: any }>('/api/analytics/mindmap-content', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

export async function getWorkspaceActivityAnalytics(range: DateRange): Promise<{
  activeWorkspaces: number
  workspaces: Array<{
    workspaceId: string
    workspaceName: string
    plan: string
    memberCount: number
    mindmapCount: number
    tokenUsage: number
    cost: number
    collaborationCount: number
    lastActivityAt: string | null
  }>
  topWorkspacesByActivity: Array<{
    workspaceId: string
    workspaceName: string
    activityScore: number
  }>
} | null> {
  const result = await apiRequest<{ data: any }>('/api/analytics/workspace-activity', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

// Analytics Alerts

export async function getAnalyticsAlerts(): Promise<{
  alerts: Array<{
    id: string
    metric: string
    severity: 'warning' | 'critical'
    currentValue: number
    expectedValue: number
    deviation: number
    message: string
    timestamp: string
  }>
  count: number
  criticalCount: number
  warningCount: number
} | null> {
  const result = await apiRequest<{ data: {
    alerts: Array<{
      id: string
      metric: string
      severity: 'warning' | 'critical'
      currentValue: number
      expectedValue: number
      deviation: number
      message: string
      timestamp: string
    }>
    count: number
    criticalCount: number
    warningCount: number
  } }>('/api/analytics/alerts', {
    method: 'GET',
  })
  return extractMetricData(result)
}

// Journey Explorer

export interface UserSearchResult {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
}

export async function searchUsers(query: string, limit = 10): Promise<UserSearchResult[]> {
  try {
    console.log('[searchUsers] Calling API with query:', query)
    const result = await apiRequest<PaginatedResponse<UserSearchResult>>(
      '/api/users/search',
      {
        method: 'POST',
        body: JSON.stringify({ query, limit }),
      }
    )
    console.log('[searchUsers] API result:', result)
    if (!result) {
      console.error('[searchUsers] API returned null - check server logs for errors')
      return []
    }
    // PaginatedResponse uses 'items' not 'data'
    if (!result.items || !Array.isArray(result.items)) {
      console.error('[searchUsers] Invalid data format:', result)
      return []
    }
    return result.items
  } catch (error) {
    console.error('[searchUsers] Error:', error)
    return []
  }
}

export interface TeamSearchResult {
  id: string
  name: string
  slug?: string
}

export async function searchTeams(query: string, limit = 10): Promise<TeamSearchResult[]> {
  try {
    console.log('[searchTeams] Calling API with query:', query)
    const result = await apiRequest<PaginatedResponse<TeamSearchResult>>(
      '/api/teams',
      {
        method: 'POST',
        body: JSON.stringify({ 
          page: 1, 
          pageSize: limit,
          search: query,
        }),
      }
    )
    console.log('[searchTeams] API result:', result)
    if (!result) {
      console.error('[searchTeams] API returned null - check server logs for errors')
      return []
    }
    // PaginatedResponse uses 'items' not 'data'
    if (!result.items || !Array.isArray(result.items)) {
      console.error('[searchTeams] Invalid data format:', result)
      return []
    }
    return result.items.map(team => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
    }))
  } catch (error) {
    console.error('[searchTeams] Error:', error)
    return []
  }
}

export async function getJourney(
  entityType: 'user' | 'team',
  entityId: string,
  range: DateRange
): Promise<{
  events: Array<{
    id: string
    type: string
    timestamp: string
    description: string
    metadata?: Record<string, any>
  }>
  count: number
  entityType: string
  entityId: string
} | null> {
  const result = await apiRequest<{ data: {
    events: Array<{
      id: string
      type: string
      timestamp: string
      description: string
      metadata?: Record<string, any>
    }>
    count: number
    entityType: string
    entityId: string
  } }>('/api/analytics/journeys', {
    method: 'POST',
    body: JSON.stringify({
      [entityType === 'user' ? 'userId' : 'teamId']: entityId,
      dateFrom: range.start.toISOString(),
      dateTo: range.end.toISOString(),
    }),
  })
  return extractMetricData(result)
}

/**
 * Get wallet metrics
 */
export async function getWalletMetrics(
  range: DateRange,
  threshold?: number
): Promise<{
  dailyBreakdown: Array<{ date: string; credits: number; debits: number; net: number }>
  totals: { credits: number; debits: number; net: number }
  activeWallets: number
  lowBalanceCount: number
  threshold: number
  uniqueUsers: number
  generatedAt: string
} | null> {
  const result = await apiRequest<MetricResponse<{
    dailyBreakdown: Array<{ date: string; credits: number; debits: number; net: number }>
    totals: { credits: number; debits: number; net: number }
    activeWallets: number
    lowBalanceCount: number
    threshold: number
    uniqueUsers: number
    generatedAt: string
  }>>(
    '/api/analytics/wallet-metrics',
    {
      method: 'POST',
      body: JSON.stringify({
        dateFrom: range.start.toISOString(),
        dateTo: range.end.toISOString(),
        threshold: threshold || 1000,
      }),
    }
  )

  if (!result) return null
  return extractMetricData(result)
}

/**
 * Get user health score
 */
export async function getUserHealthScore(userId: string): Promise<{
  userId: string
  score: number
  factors: {
    activity: number
    engagement: number
    featureUsage: number
    sentiment: number
    payment: number
  }
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  lastCalculated: string
  trends: {
    scoreChange: number
    trend: 'improving' | 'stable' | 'declining'
  }
  recommendations: string[]
} | null> {
  const result = await apiRequest<{ data: any }>(`/api/analytics/user-health/${userId}`, {
    method: 'GET',
  })
  return extractMetricData(result)
}

/**
 * Get user health scores
 */
export async function getUserHealthScores(filter: 'all' | 'at_risk' = 'at_risk', limit: number = 50): Promise<{
  items: Array<{
    userId: string
    score: number
    factors: {
      activity: number
      engagement: number
      featureUsage: number
      sentiment: number
      payment: number
    }
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    lastCalculated: string
    trends: {
      scoreChange: number
      trend: 'improving' | 'stable' | 'declining'
    }
    recommendations: string[]
  }>
  total: number
}> {
  const result = await apiRequest<{ items: any[]; total: number }>(`/api/analytics/user-health?filter=${filter}&limit=${limit}`, {
    method: 'GET',
  })
  return {
    items: result?.items || [],
    total: result?.total || 0,
  }
}

export const TABLE_NAMES = [
  'teams',
  'users',
  'token_wallets',
  'sessions',
  'ai_jobs',
  'subscriptions',
  'invoices',
  'payments',
  'credits',
  'feature_flags',
  'feature_flag_overrides',
  'api_keys',
  'webhook_endpoints',
  'webhook_logs',
  'audit_logs',
] as const

export type TableName = typeof TABLE_NAMES[number]

