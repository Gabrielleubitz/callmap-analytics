/**
 * System Knowledge for AI Agents
 * 
 * Central place to define what the agents know about CallMap.
 * Used to inject context into agent prompts.
 */

export type AgentType = 'product' | 'dev'
export type Tone = 'normal' | 'brutal'

export const NAVIGATION_STRUCTURE = {
  primary: [
    { path: '/', label: 'Overview' },
    { path: '/monitoring/live', label: 'Live' },
    { path: '/teams', label: 'Teams' },
    { path: '/users', label: 'Users' },
    { path: '/usage', label: 'Usage & Tokens' },
    { path: '/billing', label: 'Billing' },
    { path: '/ops', label: 'Ops' },
    { path: '/admin/ai-agents', label: 'AI Agents' },
    { path: '/support/errors', label: 'Support' },
  ],
  secondary: [
    { path: '/insights', label: 'Insights' },
    { path: '/users/health', label: 'User Health' },
    { path: '/predictions/churn', label: 'Churn Prediction' },
    { path: '/predictions/revenue', label: 'Revenue Forecast' },
    { path: '/predictions/usage', label: 'Usage Forecast' },
    { path: '/revenue/optimization', label: 'Revenue Optimization' },
    { path: '/dashboards', label: 'Dashboards' },
    { path: '/analytics/chat', label: 'AI Copilot' },
    { path: '/reports', label: 'Reports' },
    { path: '/benchmarks', label: 'Benchmarks' },
    { path: '/monitoring/alerts', label: 'Alerts' },
    { path: '/explorer', label: 'Data Explorer' },
    { path: '/journeys', label: 'Journeys' },
    { path: '/diagnostics', label: 'Diagnostics' },
    { path: '/settings', label: 'Settings' },
  ],
}

export const FEATURES = [
  {
    id: 'mindmap-generation',
    name: 'AI-Powered Mindmap Generation',
    description: 'Converts transcripts (audio, video, PDF, text, email, YouTube) into interactive mindmaps',
    routes: ['/'],
  },
  {
    id: 'workspace-collaboration',
    name: 'Workspace & Collaboration',
    description: 'Multi-tenant workspaces with role-based access, collaborative notes with @mentions',
    routes: ['/teams', '/users'],
  },
  {
    id: 'analytics-dashboard',
    name: 'Analytics Dashboard',
    description: 'Comprehensive analytics for users, teams, usage, billing, and system health',
    routes: ['/', '/insights', '/users/health', '/predictions'],
  },
  {
    id: 'error-tracking',
    name: 'Error Tracking & Support',
    description: 'Real-time error tracking, AI triage, and support workflow',
    routes: ['/support/errors'],
  },
  {
    id: 'ai-agents',
    name: 'AI Agents',
    description: 'AI-powered product and dev feedback, prompt generation, and analytics queries',
    routes: ['/admin/ai-agents'],
  },
  {
    id: 'billing-subscriptions',
    name: 'Billing & Subscriptions',
    description: 'Plan management, payments, invoices, credits, and revenue tracking',
    routes: ['/billing'],
  },
  {
    id: 'monitoring',
    name: 'Real-Time Monitoring',
    description: 'Live system metrics, alerts, and activity feeds',
    routes: ['/monitoring/live', '/monitoring/alerts'],
  },
]

export const ROLES_AND_PERMISSIONS = {
  founder: {
    label: 'Founder',
    permissions: ['all'],
    description: 'Full access to everything',
  },
  superAdmin: {
    label: 'Super Admin',
    permissions: [
      'view_all_data',
      'manage_users',
      'manage_teams',
      'manage_billing',
      'view_analytics',
      'manage_ai_agents',
      'manage_support',
      'export_data',
    ],
    description: 'Full admin access to analytics and management',
  },
  admin: {
    label: 'Admin',
    permissions: [
      'view_analytics',
      'view_users',
      'view_teams',
      'manage_support',
    ],
    description: 'Limited admin access',
  },
  user: {
    label: 'Regular User',
    permissions: ['view_own_data', 'create_mindmaps'],
    description: 'Standard user access in the main app',
  },
}

export const DATA_MODELS = {
  users: {
    description: 'User profiles with plans, token balances, and activity',
    keyFields: ['id', 'email', 'plan', 'tokenBalance', 'createdAt', 'lastActiveAt'],
  },
  workspaces: {
    description: 'Team workspaces with members, roles, and shared resources',
    keyFields: ['id', 'name', 'plan', 'ownerUserId', 'memberCount'],
  },
  mindmaps: {
    description: 'AI-generated mindmaps with nodes, tags, and metadata',
    keyFields: ['id', 'workspaceId', 'userId', 'outlineJson', 'tags', 'createdAt'],
  },
  documents: {
    description: 'Uploaded files (audio, video, PDF) that are processed into mindmaps',
    keyFields: ['id', 'workspaceId', 'userId', 'sourceType', 'status', 'transcriptText'],
  },
  processingJobs: {
    description: 'Background jobs for transcription and mindmap generation',
    keyFields: ['id', 'type', 'status', 'tokensIn', 'tokensOut', 'costUsd'],
  },
  actionItems: {
    description: 'Extracted action items from mindmaps with status and due dates',
    keyFields: ['id', 'mindmapId', 'text', 'status', 'dueDate'],
  },
}

export const ANALYTICS_CAPABILITIES = {
  userMetrics: [
    'Total users',
    'Active users (1d, 7d, 30d)',
    'New registrations',
    'User retention',
    'Plan distribution',
    'Most active users',
  ],
  mindmapMetrics: [
    'Total mindmaps',
    'Mindmaps per day/week',
    'Average nodes per mindmap',
    'Tag distribution',
    'Most active mindmaps',
    'Distribution by source type',
    'Generation time',
    'Edit count',
    'Export count',
  ],
  workspaceMetrics: [
    'Active workspaces',
    'Workspaces by plan',
    'Member count per workspace',
    'Mindmaps per workspace',
    'Token usage per workspace',
    'Cost per workspace',
    'Collaboration activity',
  ],
  engagementMetrics: [
    'Sessions per user',
    'Actions per session',
    'Mindmap funnel conversion rates',
    'File conversion success rate',
    'Export rate',
    'Collaboration activity',
  ],
  aiAndCostMetrics: [
    'Token usage by model',
    'Token usage by feature',
    'Token usage by plan',
    'Cost by workspace',
    'Cost by user',
    'Most expensive sessions',
    'Top teams by tokens',
    'Top teams by cost',
  ],
  systemHealthMetrics: [
    'Error counts',
    'Failed AI calls',
    'Failed file conversions',
    'Processing job failures',
    'Support error tracking',
  ],
}

export const API_ENDPOINTS = {
  analytics: [
    '/api/analytics/overview',
    '/api/analytics/mindmap-content',
    '/api/analytics/workspace-activity',
    '/api/analytics/user-health',
    '/api/analytics/predictions/churn',
    '/api/analytics/predictions/revenue',
    '/api/analytics/predictions/usage',
  ],
  users: [
    '/api/users',
    '/api/users/search',
    '/api/users/[id]',
    '/api/users/[id]/sessions',
  ],
  teams: [
    '/api/teams',
    '/api/teams/[id]',
    '/api/teams/[id]/users',
    '/api/teams/[id]/sessions',
  ],
  billing: [
    '/api/billing/metrics',
    '/api/billing/subscriptions',
    '/api/billing/payments',
    '/api/billing/invoices',
  ],
  support: [
    '/api/support/errors',
    '/api/support/errors/list',
    '/api/support/kb',
  ],
}

/**
 * Get base system prompt for an agent
 */
export function getBaseSystemPrompt(agentType: AgentType, tone: Tone): string {
  const toneInstruction = tone === 'brutal'
    ? `You are BRUTALLY HONEST. No sugarcoating. No fluff. Call out problems directly. Be harsh but constructive.`
    : `Be direct and honest, but professional.`

  if (agentType === 'product') {
    return `You are a Product and UX expert for CallMap's analytics dashboard.

${toneInstruction}

YOUR ROLE:
- Product and UX partner focused on clarity, value, and user experience
- Review features, UI, flows, and roadmap decisions
- Point out weak copy, confusing flows, and visual issues
- Prioritize changes that impact activation, retention, and usability

BEHAVIOR:
- Be direct and actionable
- No generic fluff - always provide concrete changes
- Ask clarifying questions when needed (target user, metric to move, resource limits)
- Focus on what users actually need, not what sounds good

SYSTEM KNOWLEDGE:
Navigation: ${JSON.stringify(NAVIGATION_STRUCTURE)}
Features: ${JSON.stringify(FEATURES)}
Roles: ${JSON.stringify(ROLES_AND_PERMISSIONS)}
Analytics: ${JSON.stringify(ANALYTICS_CAPABILITIES)}

When suggesting improvements:
- Name specific pages, components, or flows
- Explain why the change matters
- Consider implementation complexity
- Flag if this needs design work vs quick fixes`
  }

  if (agentType === 'dev') {
    return `You are a Senior Engineer for CallMap's analytics dashboard.

${toneInstruction}

YOUR ROLE:
- Senior engineer focused on security, performance, and maintainability
- Review architecture, code quality, and technical decisions
- Flag risky patterns and suggest refactors
- Keep an eye on auth, RBAC, rate limiting, query performance, error handling

BEHAVIOR:
- Use clear, practical suggestions
- Structure suggestions so Cursor prompts are straightforward to generate
- Suggest work in small, safe steps
- Prioritize security and performance issues

SYSTEM KNOWLEDGE:
Navigation: ${JSON.stringify(NAVIGATION_STRUCTURE)}
Features: ${JSON.stringify(FEATURES)}
Roles: ${JSON.stringify(ROLES_AND_PERMISSIONS)}
Data Models: ${JSON.stringify(DATA_MODELS)}
API Endpoints: ${JSON.stringify(API_ENDPOINTS)}
Analytics: ${JSON.stringify(ANALYTICS_CAPABILITIES)}

When suggesting improvements:
- Name specific files, routes, or components
- Describe security implications
- Consider performance impact
- Suggest incremental refactors
- Include acceptance criteria`
  }

  return ''
}

/**
 * Get feature context for a specific route or feature
 */
export function getFeatureContext(routePath?: string, featureId?: string): string {
  if (featureId) {
    const feature = FEATURES.find(f => f.id === featureId)
    if (feature) {
      return `Feature: ${feature.name}\nDescription: ${feature.description}\nRoutes: ${feature.routes.join(', ')}`
    }
  }

  if (routePath) {
    const feature = FEATURES.find(f => f.routes.includes(routePath))
    if (feature) {
      return `Current Route: ${routePath}\nFeature: ${feature.name}\nDescription: ${feature.description}`
    }
  }

  return ''
}

