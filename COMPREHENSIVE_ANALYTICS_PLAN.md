# Comprehensive Analytics Implementation Plan

## Overview
This document outlines the complete analytics system for CallMap, ensuring founders and super admins have full visibility into product usage, user behavior, system health, and business metrics.

## Data Schema (from mindmap-backup-original)

### Core Collections
1. **users** - User profiles, plans, token balances, Stripe customer IDs
2. **workspaces** - Team info, plans, owner user IDs
3. **workspaces/{id}/members** - Membership and roles
4. **mindmaps** - Mindmap data: outlineJson, layoutJson, summaryMarkdown, sentiment scores, tags
5. **documents** - Upload metadata, transcriptText, status
6. **processingJobs** - Background job queue (transcription, mindmap generation)
7. **analyticsEvents** - Event tracking for all user actions
8. **actionItems** - Extracted action items with status, dueDate
9. **workspaceDailyMemberMetrics** - Daily analytics per member
10. **workspaceUsage/{workspaceId}/months/{YYYY-MM}** - Monthly token usage totals
11. **users/{userId}/weeklyActivity/{weekKey}** - Weekly user activity tracking

### Key Fields to Track

#### Users
- `plan`: free | pro | team | enterprise
- `tokenBalance`: Current token balance
- `stripeCustomerId`: Billing customer ID
- `createdAt`: Account creation date
- `lastActivityAt`: Last activity timestamp
- `email`: User email

#### Workspaces
- `plan`: Workspace plan
- `ownerUserId`: Workspace owner
- `name`: Workspace name
- `createdAt`: Creation date

#### Mindmaps
- `userId`: Creator user ID
- `workspaceId`: Associated workspace (null for personal)
- `sourceType`: call | meeting | upload | url | email
- `generationTimeMs`: Time to generate
- `editCount`: Number of edits
- `lastEditedAt`: Last edit timestamp
- `exportCount_pdf`, `exportCount_png`: Export counts
- `sentimentScore`: Sentiment analysis score
- `tags`: Array of tags
- `createdAt`: Creation timestamp

#### ProcessingJobs
- `tokensIn`: Input tokens
- `tokensOut`: Output tokens
- `costUsd`: Cost in USD
- `mindmapId`: Associated mindmap
- `workspaceId`: Associated workspace
- `userId`: User who triggered
- `model`: AI model used
- `type`: Job type (generate, edit, export, etc.)
- `status`: completed | failed | processing
- `createdAt`: Job creation timestamp

#### AnalyticsEvents
- `type`: Event type (mindmap_generation, mindmap_edit, file_conversion, etc.)
- `userId`: User who triggered
- `workspaceId`: Associated workspace
- `timestamp`: Event timestamp
- Event-specific metadata

## Analytics Requirements

### User & Account Level Metrics
✅ Total users count
✅ Active users (last day, week, month)
✅ Most active users
✅ Workspaces/teams count and activity
✅ User retention by week
✅ User plan distribution

### Mindmap & Content Level Metrics
✅ Total mindmaps count
✅ Mindmaps created per day/week
✅ Average nodes per mindmap
✅ Distribution by owner/workspace
✅ Most opened/edited mindmaps
✅ Mindmap generation time
✅ Edit count per mindmap
✅ Export rate (PDF/PNG)

### Engagement & Usage Metrics
✅ Sessions per user per day/week
✅ Average session duration (if available)
✅ Actions per session:
  - Mindmaps created
  - Nodes added
  - Tags applied
  - Exports triggered
✅ Mindmap funnel (upload → process → generate → view → edit → export)
✅ File conversion success rate

### AI Usage & Cost Metrics
✅ AI calls per day/customer
✅ Token usage by workspace/user
✅ Token usage by feature
✅ Cost by workspace/user
✅ Cost by model
✅ Most expensive sessions

### System Health Metrics
✅ Error counts over time
✅ Failed AI calls
✅ Failed file conversions
✅ Data sync/backup issues
✅ Processing job failure rate

## Implementation Status

### ✅ Already Implemented
1. Overview dashboard with key metrics
2. User and team pages
3. Usage & tokens page
4. Billing page
5. Ops page
6. Support error tracking
7. Analytics API endpoints for:
   - Overview metrics
   - Mindmap generation time
   - Mindmap edit count
   - File conversion rate
   - User retention
   - Mindmap funnel
   - Export rate
   - Collaboration activity
   - Token burn by feature
   - Call logs analytics
   - Action items analytics
   - Contacts analytics

### 🔄 Needs Enhancement
1. **Session duration tracking** - Need to add session start/end events
2. **Node count per mindmap** - Need to extract from outlineJson
3. **Tag distribution** - Need to aggregate tags from mindmaps
4. **Most active mindmaps** - Need to track view counts better
5. **Average nodes per mindmap** - Need to calculate from outlineJson
6. **Workspace activity metrics** - Need better aggregation
7. **Daily/weekly active users** - Need to verify calculation
8. **User journey visualization** - Need to enhance journey page

### 📝 Missing Analytics
1. **Session duration** - Track session start/end
2. **Node operations** - Track node additions/edits/deletions
3. **Tag operations** - Track tag additions/removals
4. **Search usage** - Track search queries
5. **Template usage** - Track template selections
6. **Integration usage** - Track Gmail, Net2Phone, etc. usage
7. **Workspace collaboration metrics** - Better aggregation
8. **Feature adoption** - Track which features users use

## Next Steps

1. ✅ Create this plan document
2. 🔄 Audit all tracking calls in mindmap backend
3. 🔄 Build missing analytics endpoints
4. 🔄 Enhance frontend visualizations
5. 🔄 Add session duration tracking
6. 🔄 Add node/tag operation tracking
7. 🔄 Verify all metrics are accurate
8. 🔄 Add tests for critical analytics

