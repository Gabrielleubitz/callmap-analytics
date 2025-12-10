// Database types and functions
// These fetch data from Next.js API routes (which use Firebase Admin SDK)

// Use Next.js API routes (server-side, no CORS issues)
const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3000'

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
      return null
    }
    
    return await response.json()
  } catch (error) {
    return null
  }
}

export type DateRange = {
  start: Date
  end: Date
}

export type Plan = 'free' | 'pro' | 'team' | 'enterprise'
export type UserRole = 'owner' | 'admin' | 'member'
export type UserStatus = 'active' | 'invited' | 'disabled'
export type SessionSourceType = 'call' | 'meeting' | 'upload' | 'url'
export type SessionStatus = 'queued' | 'processing' | 'ready' | 'failed'
export type AIJobType = 'transcribe' | 'summarize' | 'map' | 'export'
export type AIJobStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void'
export type CreditType = 'promo' | 'support' | 'manual'

export interface Team {
  id: string
  name: string
  slug: string
  plan: Plan
  created_at: Date
  owner_user_id: string
  country: string | null
  is_active: boolean
}

export interface User {
  id: string
  team_id: string | null
  email: string
  name: string | null
  role: UserRole
  status: UserStatus
  created_at: Date
  last_login_at: Date | null
  last_activity_at: Date | null
}

export interface TokenWallet {
  id: string
  team_id: string | null
  user_id: string | null
  monthly_quota_tokens: number
  tokens_used_this_month: number
  tokens_used_total: number
  resets_at: Date
}

export interface Session {
  id: string
  team_id: string | null
  user_id: string | null
  source_type: SessionSourceType
  status: SessionStatus
  duration_seconds: number | null
  chars_in: number | null
  tokens_in: number | null
  tokens_out: number | null
  model: string | null
  cost_usd: number | null
  created_at: Date
}

export interface AIJob {
  id: string
  session_id: string | null
  type: AIJobType
  status: AIJobStatus
  started_at: Date | null
  finished_at: Date | null
  tokens_in: number | null
  tokens_out: number | null
  cost_usd: number | null
  error_message: string | null
}

export interface Subscription {
  id: string
  team_id: string
  plan: Plan
  provider: string
  status: SubscriptionStatus
  trial_end: Date | null
  current_period_start: Date
  current_period_end: Date
  cancel_at: Date | null
  canceled_at: Date | null
}

export interface Invoice {
  id: string
  team_id: string
  amount_usd: number
  status: InvoiceStatus
  due_date: Date
  paid_at: Date | null
  period_start: Date
  period_end: Date
}

export interface Payment {
  id: string
  team_id: string
  amount_usd: number
  provider: string
  provider_charge_id: string | null
  created_at: Date
}

export interface Credit {
  id: string
  team_id: string
  type: CreditType
  amount_usd: number
  created_at: Date
  expires_at: Date | null
}

export interface FeatureFlag {
  id: string
  key: string
  description: string | null
  is_enabled_default: boolean
}

export interface FeatureFlagOverride {
  id: string
  flag_id: string
  team_id: string | null
  user_id: string | null
  is_enabled: boolean
}

export interface APIKey {
  id: string
  team_id: string
  name: string
  last_used_at: Date | null
  created_at: Date
  is_active: boolean
}

export interface WebhookEndpoint {
  id: string
  team_id: string
  url: string
  event_types: string[]
  created_at: Date
  last_success_at: Date | null
  last_failure_at: Date | null
  is_active: boolean
}

export interface WebhookLog {
  id: string
  endpoint_id: string
  status_code: number | null
  attempted_at: Date
  latency_ms: number | null
  error_message: string | null
}

export interface AuditLog {
  id: string
  team_id: string | null
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, any> | null
  created_at: Date
}

export interface OverviewMetrics {
  total_users: number
  active_users: number
  new_registrations: number
  active_teams: number
  sessions: number
  tokens_used: number
  estimated_cost: number
  mrr_estimate: number
}

export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface TeamsParams extends PaginationParams {
  plan?: Plan[]
  country?: string[]
  subscriptionStatus?: SubscriptionStatus[]
  tokensUsedMin?: number
  tokensUsedMax?: number
  createdFrom?: Date
  createdTo?: Date
  search?: string
}

export interface UsersParams extends PaginationParams {
  teamId?: string
  role?: UserRole[]
  status?: UserStatus[]
  hasLoggedIn?: boolean
  createdFrom?: Date
  createdTo?: Date
  activityFrom?: Date
  activityTo?: Date
  tokensUsedMin?: number
  search?: string
}

// Database functions - fetch from Next.js API routes (server-side Firebase Admin)

export async function getOverviewMetrics(range: DateRange): Promise<OverviewMetrics> {
  const result = await apiRequest<OverviewMetrics>('/api/analytics/overview', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  
  if (result) return result
  
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
  const result = await apiRequest<{ data: Team[]; total: number }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
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
  const result = await apiRequest<{ data: User[]; total: number }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return result || { data: [], total: 0 }
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
  const result = await apiRequest<{
    totalTokensIn: number
    totalTokensOut: number
    tokensByModel: Array<{ model: string; tokens: number }>
    avgTokensPerSession: number
    totalCost: number
  }>('/api/usage/metrics', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || {
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
  const result = await apiRequest<{
    mrr: number
    totalRevenue: number
    unpaidInvoices: number
    payingTeams: number
  }>('/api/billing/metrics', {
    method: 'POST',
    body: JSON.stringify({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    }),
  })
  return result || {
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

