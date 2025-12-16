/**
 * Central type definitions for Callmap Analytics
 * 
 * These types represent the data structures used throughout the application.
 * All dates are represented as Date objects in TypeScript, but may be serialized
 * as ISO strings when sent over the network.
 */

// Enums and union types
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

// Date range for filtering
export interface DateRange {
  start: Date
  end: Date
}

// Core entities
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
  // Additional Firestore fields
  audioMinutesUsed?: number
  mapsGenerated?: number
  monthlyResetTimestamp?: Date | null
  onboarded?: boolean
  plan?: Plan
  tokenBalance?: number
  updatedAt?: Date | null
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

export interface TokenWallet {
  id: string
  team_id: string | null
  user_id: string | null
  monthly_quota_tokens: number
  tokens_used_this_month: number
  tokens_used_total: number
  resets_at: Date
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

// API Response types
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
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

export interface UsageMetrics {
  totalTokensIn: number
  totalTokensOut: number
  tokensByModel: Array<{ model: string; tokens: number }>
  avgTokensPerSession: number
  totalCost: number
}

export interface BillingMetrics {
  mrr: number
  totalRevenue: number
  unpaidInvoices: number
  payingTeams: number
}

export interface AIJobStats {
  failureRate: number
  longestRunningJob: number
  avgDurationByType: Array<{ type: AIJobType; duration: number }>
}

// Request parameter types
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

// User update payload (only editable fields)
export interface UserUpdatePayload {
  name?: string
  email?: string
  role?: UserRole
  status?: UserStatus
  plan?: Plan
  onboarded?: boolean
  tokenBalance?: number
  audioMinutesUsed?: number
  mapsGenerated?: number
  monthlyResetTimestamp?: string // ISO string
}

// Support & Error Intelligence types
export type ErrorSeverity = 'info' | 'warning' | 'critical'
export type TriageStatus = 'pending' | 'processing' | 'done' | 'ignored' | 'escalated'
export type ResolutionType = 'user_action' | 'engineering_fix' | 'config_change' | 'ignored'
export type ErrorSource = 'client' | 'server' | 'worker' | 'cron'

export interface SupportErrorEvent {
  id: string
  // Error details
  message: string
  stack?: string | null
  error_code?: string | null
  app_area: string // e.g., 'mindmap_creation', 'upload', 'export', 'billing', 'ai_generation'
  route?: string | null
  action?: string | null
  
  // Classification (automatic)
  expected: boolean
  critical: boolean
  severity: ErrorSeverity
  
  // Context
  user_id: string | null
  workspace_id: string | null
  source: ErrorSource
  
  // Resolution state
  triage_status: TriageStatus
  acknowledged_at: Date | null
  resolved_at: Date | null
  resolution_type: ResolutionType | null
  resolution_notes: string | null
  resolved_by: string | null // admin user ID
  
  // Aggregation
  occurrence_count: number
  first_seen_at: Date
  last_seen_at: Date
  
  // Metadata
  metadata: Record<string, any> | null
  created_at: Date
  updated_at: Date
}

export interface SupportErrorTriage {
  id: string
  error_id: string
  // AI analysis
  summary: string
  probable_causes: string[]
  recommended_fixes: string[]
  who_should_act: 'user' | 'support' | 'engineering'
  confidence: number // 0-1
  customer_facing_message: string
  // KB matches
  kb_entry_ids: string[]
  created_at: Date
}

export interface SupportErrorKB {
  id: string
  // Pattern matching
  error_pattern: string // regex or keyword match
  symptoms: string[]
  app_area?: string | null
  
  // Classification override
  expected: boolean
  critical: boolean
  severity: ErrorSeverity
  
  // Resolution
  root_causes: string[]
  fix_steps: string[]
  customer_message_template: string
  
  // Metadata
  created_by: string // admin user ID
  created_at: Date
  updated_at: Date
  usage_count: number
}

