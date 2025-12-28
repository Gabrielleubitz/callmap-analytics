# CallMap Analytics Platform - Complete Capabilities

## Overview
The CallMap Analytics Platform is a comprehensive admin dashboard that provides founders and super admins with full visibility into product usage, user behavior, system health, business metrics, and AI-powered insights. It serves as both an analytics console and a customer support/reliability platform.

---

## Core Features

### 1. Dashboard & Overview
**Location:** `/`

**Capabilities:**
- Real-time KPIs: Active users, sessions, tokens used, growth metrics
- System health monitoring
- Daily active users vs new registrations chart
- Sessions per day visualization
- Daily token consumption tracking
- Revenue over time
- Top teams by tokens used and cost
- Recently created teams
- Recently failed AI jobs
- Mindmap generation time analytics
- Mindmap edit count tracking
- File → Map conversion rate
- User retention by week
- User journey funnel visualization
- Export rate (PDF/PNG) tracking
- Team collaboration activity
- Token consumption by feature
- Team economics breakdown (MRR, token cost, AI margin, health scores)
- Behavior cohorts analysis
- Action items analytics
- Call logs analytics
- Contact integration analytics
- Mindmap content analytics
- Workspace activity analytics
- AI Coach integration for automatic page insights

---

### 2. Real-Time Monitoring
**Location:** `/monitoring/live`

**Capabilities:**
- Live active users count
- Active sessions tracking
- Real-time token burn rate
- Error rate monitoring
- System health dashboard
- Recent activity feed
- Token burn rate timeline (last 20 updates)
- Error rate timeline (last 20 updates)
- AI Coach integration

---

### 3. Teams Management
**Location:** `/teams` and `/teams/[id]`

**Capabilities:**
- List all teams/workspaces
- Team details view with:
  - Team information and settings
  - Member management (add, remove, update roles)
  - Billing information
  - Session history
  - Audit logs
  - Copy team ID functionality
- Team search functionality
- Team analytics and metrics
- Role-based access control (owner, admin, member)

---

### 4. Users Management
**Location:** `/users` and `/users/[id]`

**Capabilities:**
- List all users
- User search functionality
- Individual user profiles with:
  - User information and settings
  - Plan and subscription details
  - Token balance and wallet management
  - Session history
  - Audit logs
  - Feature flags management
  - Errors affecting the user
  - Personal and team workspace errors
- User health scoring
- Wallet balance adjustments (with CSRF protection)
- User role management (admin, superAdmin)

---

### 5. Usage & Tokens Analytics
**Location:** `/usage`

**Capabilities:**
- Daily token consumption tracking
- Token usage by source
- Token usage by plan
- Expensive sessions identification
- Teams over quota tracking
- Session analytics
- Usage metrics and trends

---

### 6. Billing & Revenue
**Location:** `/billing`

**Capabilities:**
- Revenue metrics and trends
- Revenue by plan breakdown
- Revenue over time visualization
- Subscription management
- Payment tracking
- Invoice management
- Credits management
- Churn analysis
- Billing metrics dashboard

---

### 7. Operations (Ops)
**Location:** `/ops`

**Capabilities:**
- AI job statistics
- AI job monitoring and management
- Webhook endpoints management
- Webhook logs tracking
- System operations dashboard

---

### 8. Support & Error Intelligence
**Location:** `/support/errors` and `/support/errors/[id]`

**Capabilities:**
- **Error Inbox:**
  - List all captured errors
  - Filter by severity, expected/unexpected, critical, app area, user, workspace
  - Sort by occurrences, last seen, triage status
  - Pagination support
  
- **Error Detail View:**
  - What happened (message, stack trace, app area, route/action)
  - Occurrences timeline
  - Who is affected (user profile link, workspace context)
  - AI triage results:
    - Summary
    - Probable causes
    - Recommended fixes
    - Who should act (user, support, engineering)
    - Customer-facing message
  - Support actions:
    - Mark resolved
    - Escalate to engineering
    - Ignore
    - Add to knowledge base
  - Resolution tracking (resolution_type, resolution_notes)
  
- **Error Classification:**
  - Automatic classification: expected/unexpected, critical/non-critical, severity (info/warning/critical)
  - Rules-based classification for known error patterns
  - Knowledge base overrides
  
- **AI Triage:**
  - Background job for error analysis
  - OpenAI-powered diagnosis
  - KB entry matching
  - Confidence scoring
  
- **Knowledge Base:**
  - CRUD operations for KB entries
  - Error patterns, symptoms, root causes, fix steps
  - Expected/critical status definitions
  
- **File Logging:**
  - Daily error logs (`/downloads/mindmap/support-errors/YYYY-MM-DD.jsonl`)
  - Per-user error logs
  - Per-workspace error logs
  - Firebase Storage fallback
  
- **Navbar Integration:**
  - Error notification bell with badge count
  - Unacknowledged unexpected/critical errors
  - Quick access to latest errors

---

### 9. AI Agents
**Location:** `/admin/ai-agents`

**Capabilities:**
- **Two Modes:**
  - **Single Agent Mode:** Product/Dev agents with tone control (Normal/Brutal)
  - **Multi-Agent Mode:** All agents (Marketing, Support, Product, Revenue, Ops) with @mention tagging

- **Available Agents:**
  - **Marketing Agent:** Growth, acquisition, activation, retention
  - **Support Agent:** Reliability, errors, customer pain
  - **Product Agent:** Feature usage, stickiness, UX
  - **Revenue Agent:** Plans, MRR, monetization
  - **Ops Agent:** Throughput, costs, operational health
  - **Dev Agent:** Security, architecture, performance, code quality

- **Features:**
  - Agent selection with visual feedback
  - @mention tagging in messages (e.g., `@marketing @support`)
  - Tone control (Normal/Brutal) for Product/Dev agents
  - Quick Actions panel with one-click prompts:
    - Top 3 Product Risks
    - Top 3 Security Risks
    - Kill or Fix Feature
    - Biggest Usage Drop
  - Chat interface with message history
  - Generate Prompt button for Cursor integration
  - Agent badges on responses
  - URL parameter support for pre-filling questions and agents
  - Contextual loading states
  - Export capabilities for data-driven answers

---

### 10. AI Copilot
**Location:** `/analytics/chat`

**Capabilities:**
- Natural language queries about analytics data
- Intelligent agent selection
- Combined, synthesized responses from multiple agents
- Contributing agents displayed at top of response
- Structured output with:
  - Summary
  - Key metrics
  - Recommendations
- Access to entire database for reading
- Neat, formatted information display

---

### 11. AI Coach
**Location:** Integrated across all pages

**Capabilities:**
- Automatic page context analysis
- Simple overview of what user is looking at
- Key takeaways from the data
- Suggested AI agents for deeper questions
- Pre-filled prompts for AI Agents page
- Collapsible interface (starts collapsed)
- Clean, readable design
- Refresh functionality

---

### 12. Insights & Anomaly Detection
**Location:** `/insights` and `/insights/anomalies`

**Capabilities:**
- AI-powered insights generation
- Automatic anomaly detection
- Period-based analysis (daily, weekly, monthly)
- Summary and recommendations
- Anomaly dashboard with:
  - Detected anomalies
  - Severity levels
  - Impact analysis
  - Recommended actions
- AI Coach integration

---

### 13. Predictive Analytics
**Locations:** `/predictions/churn`, `/predictions/revenue`, `/predictions/usage`

**Capabilities:**
- **Churn Prediction:**
  - Churn risk scoring per user
  - High-risk user identification
  - Churn risk distribution
  - Churn predictions table
  - AI Coach integration

- **Revenue Forecasting:**
  - Revenue forecast trends
  - Forecast factors analysis
  - Historical vs predicted comparison
  - AI Coach integration

- **Usage Forecasting:**
  - Usage forecast trends
  - Metric selection (sessions, tokens, mindmaps)
  - Forecast visualization
  - AI Coach integration

---

### 14. User Health Scoring
**Location:** `/users/health`

**Capabilities:**
- User health score calculation
- Health score distribution
- Individual user health details
- Factors affecting health:
  - Activity level
  - Engagement
  - Feature usage
  - Error frequency
  - Support interactions
- Health trends over time
- AI Coach integration

---

### 15. Revenue Optimization
**Location:** `/revenue/optimization`

**Capabilities:**
- Revenue opportunity identification
- Upsell opportunities
- Win-back candidates
- Opportunity value calculation
- Prioritized recommendations
- AI Coach integration

---

### 16. Custom Dashboards
**Location:** `/dashboards`

**Capabilities:**
- Create custom dashboards
- Drag-and-drop widget placement
- Widget library
- Dashboard CRUD operations
- Save and share dashboards
- Multiple dashboard support

---

### 17. Reports
**Location:** `/reports`

**Capabilities:**
- Automated report generation
- Scheduled reports
- Report templates
- Export options (PDF, CSV, Excel)
- Report history
- Custom report builder

---

### 18. Benchmarks
**Location:** `/benchmarks`

**Capabilities:**
- Industry benchmarks
- Internal benchmarking
- Performance comparisons
- Metric normalization
- Trend analysis

---

### 19. Monitoring & Alerts
**Location:** `/monitoring/alerts`

**Capabilities:**
- Alert rule creation and management
- Alert rule evaluation engine
- Real-time alerting
- Alert history
- Alert severity levels
- Notification channels

---

### 20. User Journeys
**Location:** `/journeys`

**Capabilities:**
- User journey visualization
- Journey funnel analysis
- User and team search
- Journey path tracking
- Conversion point identification
- Drop-off analysis

---

### 21. Data Explorer
**Location:** `/explorer`

**Capabilities:**
- Raw data exploration
- Query builder
- Data filtering and sorting
- Export capabilities
- Data visualization options

---

### 22. Diagnostics
**Location:** `/diagnostics`

**Capabilities:**
- System diagnostics
- Health checks
- Performance metrics
- Configuration validation

---

### 23. Settings
**Location:** `/settings`

**Capabilities:**
- Platform settings
- User preferences
- Configuration management

---

## API Endpoints

### Analytics APIs
- `/api/analytics/overview` - Overview metrics
- `/api/analytics/daily-active-users` - Daily active users
- `/api/analytics/daily-sessions` - Daily sessions
- `/api/analytics/daily-tokens-by-model` - Token usage by model
- `/api/analytics/mindmap-content` - Mindmap content analytics
- `/api/analytics/workspace-activity` - Workspace activity analytics
- `/api/analytics/action-items` - Action items analytics
- `/api/analytics/call-logs` - Call logs analytics
- `/api/analytics/contacts` - Contacts analytics
- `/api/analytics/collaboration-activity` - Collaboration analytics
- `/api/analytics/user-retention` - User retention
- `/api/analytics/mindmap-funnel` - Mindmap funnel
- `/api/analytics/file-conversion-rate` - File conversion rate
- `/api/analytics/export-rate` - Export rate
- `/api/analytics/mindmap-generation-time` - Generation time
- `/api/analytics/mindmap-edit-count` - Edit count
- `/api/analytics/token-burn-by-feature` - Token usage by feature
- `/api/analytics/tokens-by-plan` - Tokens by plan
- `/api/analytics/top-teams-by-tokens` - Top teams by tokens
- `/api/analytics/top-teams-by-cost` - Top teams by cost
- `/api/analytics/recent-teams` - Recent teams
- `/api/analytics/recent-failed-jobs` - Recent failed jobs
- `/api/analytics/map-economics` - Map economics
- `/api/analytics/behavior-cohorts` - Behavior cohorts
- `/api/analytics/wallet-metrics` - Wallet metrics
- `/api/analytics/journeys` - User journeys
- `/api/analytics/user-health` - User health scores
- `/api/analytics/user-health/[userId]` - Individual user health
- `/api/analytics/predictions/churn` - Churn predictions
- `/api/analytics/predictions/revenue` - Revenue forecasts
- `/api/analytics/predictions/usage` - Usage forecasts
- `/api/analytics/revenue-opportunities` - Revenue opportunities
- `/api/analytics/copilot` - AI Copilot queries

### Support APIs
- `/api/support/errors` - Error capture endpoint
- `/api/support/errors/list` - List errors with filtering
- `/api/support/errors/[id]` - Get/update individual error
- `/api/support/kb` - Knowledge base CRUD
- `/api/support/kb/[id]` - Individual KB entry operations
- `/api/support/jobs/triage` - AI triage background job

### AI APIs
- `/api/admin/ai-agents` - AI agent queries
- `/api/admin/ai-agents/generate-prompt` - Generate Cursor prompts
- `/api/ai/explain-page` - Page explanation generation
- `/api/insights/generate` - Generate insights
- `/api/insights/anomalies` - Anomaly detection

### Monitoring APIs
- `/api/monitoring/live` - Real-time monitoring data
- `/api/monitoring/alerts` - Alert management

### Billing APIs
- `/api/billing/metrics` - Billing metrics
- `/api/billing/revenue-over-time` - Revenue trends
- `/api/billing/revenue-by-plan` - Revenue by plan
- `/api/billing/subscriptions` - Subscription data
- `/api/billing/payments` - Payment data
- `/api/billing/invoices` - Invoice data
- `/api/billing/credits` - Credits data
- `/api/billing/churn` - Churn analysis

### Usage APIs
- `/api/usage/metrics` - Usage metrics
- `/api/usage/daily-tokens` - Daily token usage
- `/api/usage/tokens-by-source` - Tokens by source
- `/api/usage/sessions` - Session data
- `/api/usage/expensive-sessions` - Expensive sessions
- `/api/usage/teams-over-quota` - Teams over quota

### Teams APIs
- `/api/teams` - List teams
- `/api/teams/[id]` - Team details
- `/api/teams/[id]/users` - Team members
- `/api/teams/[id]/users/add` - Add team member
- `/api/teams/[id]/users/remove` - Remove team member
- `/api/teams/[id]/users/update-role` - Update member role
- `/api/teams/[id]/billing` - Team billing
- `/api/teams/[id]/sessions` - Team sessions
- `/api/teams/[id]/audit-logs` - Team audit logs

### Users APIs
- `/api/users` - List users
- `/api/users/search` - Search users
- `/api/users/[id]` - User details
- `/api/users/[id]/update` - Update user
- `/api/users/[id]/sessions` - User sessions
- `/api/users/[id]/audit-logs` - User audit logs
- `/api/users/[id]/feature-flags` - Feature flags
- `/api/admin/wallet/[userId]/adjust` - Adjust wallet balance
- `/api/admin/wallet/[userId]/transactions` - Wallet transactions

### Dashboards APIs
- `/api/dashboards` - Dashboard CRUD
- `/api/dashboards/[id]` - Individual dashboard operations

### Reports APIs
- `/api/reports/generate` - Generate reports

### Ops APIs
- `/api/ops/ai-jobs` - AI job data
- `/api/ops/ai-job-stats` - AI job statistics
- `/api/ops/webhook-endpoints` - Webhook endpoints
- `/api/ops/webhook-logs` - Webhook logs

### Auth APIs
- `/api/auth/login` - User login
- `/api/auth/logout` - User logout
- `/api/auth/session` - Session validation
- `/api/auth/csrf-token` - CSRF token generation
- `/api/auth/mfa/enroll` - MFA enrollment
- `/api/auth/mfa/verify` - MFA verification

### Admin APIs
- `/api/admin/set-role` - Set user role
- `/api/admin/revoke-access` - Revoke access
- `/api/admin/users` - Admin user operations

---

## Data Models

### Support Error System
- `support_error_events` - Error events with classification and resolution tracking
- `support_error_kb` - Knowledge base entries
- `support_error_triage` - AI triage results

### Analytics
- `customDashboards` - Custom dashboard definitions
- `alertRules` - Alert rule configurations
- `insights` - Generated insights
- `predictions` - Predictive analytics results
- `reports` - Report definitions and history

### AI System
- `ai_conversations` - AI agent conversation history

---

## Security Features

- Role-based access control (founder, superAdmin, admin, user)
- CSRF protection for sensitive operations
- Session cookie authentication
- MFA support
- Admin-only endpoints
- Secure wallet balance adjustments
- Audit logging for sensitive actions

---

## Integration Points

### Error Tracking Integration
- Error capture from mindmap application
- Unified error capture API
- Automatic error classification
- File logging with Firebase Storage fallback

### AI Integration
- OpenAI API for:
  - AI agent responses
  - Error triage
  - Insights generation
  - Page explanations
  - Anomaly detection
  - Predictive analytics

---

## Technical Capabilities

- Real-time data updates
- WebSocket support for live monitoring
- Pagination for large datasets
- Advanced filtering and sorting
- In-memory processing for complex queries
- Graceful error handling for missing Firestore indexes
- Responsive design
- Dark mode support (via browser/system preferences)
- Export capabilities (CSV, Excel, PDF)
- Clipboard integration for prompt generation

---

## User Experience Features

- AI Coach on every page for context
- Quick Actions for common tasks
- Visual feedback for selected agents
- @mention tagging for multi-agent queries
- Collapsible sections
- Loading states with contextual messages
- Error states with retry options
- Empty states with helpful messages
- Tooltips for guidance
- Keyboard navigation support
- Focus indicators for accessibility

---

## Analytics Dimensions

### Time Ranges
- Real-time
- Daily
- Weekly
- Monthly
- Custom date ranges

### Metrics Tracked
- User metrics (active, new, retention)
- Engagement metrics (sessions, actions, duration)
- Content metrics (mindmaps, nodes, tags, exports)
- Usage metrics (tokens, cost, features)
- Revenue metrics (MRR, subscriptions, payments)
- Health metrics (errors, failures, performance)
- Collaboration metrics (workspaces, members, activity)

---

## Future Enhancements (Planned)

- Session duration tracking
- Advanced export formats
- Google Sheets integration
- Enhanced conversation memory
- Decision Mode for CEO-style usage
- Advanced visualizations (heatmaps, Sankey diagrams, network graphs)
- Automated report scheduling
- Email notifications for alerts
- Mobile app support

---

## Documentation

- `COMPREHENSIVE_ANALYTICS_PLAN.md` - Analytics implementation plan
- `ANALYTICS_IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `PLATFORM_CAPABILITIES.md` - This document

---

*Last Updated: 2025-01-15*

