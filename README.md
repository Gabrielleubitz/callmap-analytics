
# CallMap Admin Dashboard

Internal admin dashboard for CallMap - an AI product that ingests calls, meetings, and uploads, and turns them into structured mind maps and summaries.

## Overview

This is a comprehensive admin dashboard built for founders and operations teams to monitor and manage all aspects of the CallMap business. It provides visibility into:

- Users and teams/workspaces
- Registrations and subscriptions
- Token balances and usage
- Imports/sessions
- AI job runs
- Errors and failures
- Billing, payments, refunds, and credits
- Feature flags and experiments
- API keys and webhooks
- Audit logs

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** components (custom implementation)
- **Recharts** for data visualization
- **date-fns** for date handling

## Project Structure

```
analytics/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Overview dashboard
│   ├── teams/             # Teams pages
│   ├── users/             # Users pages
│   ├── usage/             # Usage & Tokens page
│   ├── billing/           # Billing page
│   ├── ops/               # Operations page
│   ├── explorer/          # Data Explorer page
│   └── settings/          # Settings page
├── components/
│   ├── ui/                # Reusable UI components
│   └── layout/            # Layout components
├── lib/
│   ├── db.ts              # Database types and placeholder functions
│   └── utils.ts           # Utility functions
└── package.json
```

## Setup

1. **Install dependencies:**
   ```bash
   cd analytics
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000`

## Database Integration

The dashboard is designed to work with a Postgres/Supabase database. All database functions are currently placeholder implementations in `lib/db.ts`. 

To wire up real database queries:

1. Install your database client (e.g., `@supabase/supabase-js` or `pg`)
2. Update the functions in `lib/db.ts` to connect to your actual database
3. Map the database schema to match the types defined in `lib/db.ts`

### Expected Database Schema

The dashboard expects tables similar to:

- `teams` - Team/workspace information
- `users` - User accounts
- `token_wallets` - Token usage tracking
- `sessions` - Imported calls/meetings/files
- `ai_jobs` - AI processing jobs
- `subscriptions` - Subscription management
- `invoices` - Invoice records
- `payments` - Payment transactions
- `credits` - Credit allocations
- `feature_flags` - Feature flag definitions
- `feature_flag_overrides` - Feature flag overrides
- `api_keys` - API key management
- `webhook_endpoints` - Webhook configurations
- `webhook_logs` - Webhook delivery logs
- `audit_logs` - Audit trail

See `lib/db.ts` for detailed type definitions.

## Features

### Overview Dashboard
- High-level KPIs with date range filtering
- Charts for user activity, sessions, tokens, and costs
- Top teams by tokens and cost
- Recently created teams and failed jobs

### Teams
- Team index with filtering and pagination
- Team detail pages with:
  - User lists
  - Session history
  - Billing information
  - API keys and webhooks
  - Audit logs

### Users
- User index with search and filters
- User detail pages with:
  - Token usage metrics
  - Session history
  - Feature flags
  - Audit logs

### Usage & Tokens
- Token usage metrics and trends
- Charts by model and source type
- Most expensive sessions
- Teams over quota

### Billing
- MRR and revenue metrics
- Revenue charts over time
- Subscription, invoice, payment, and credit tables
- Churn analysis

### Operations
- AI job monitoring with failure rates
- Webhook endpoint status and logs
- System error aggregation

### Data Explorer
- Browse any database table
- Search and pagination
- View raw JSON for any row

### Settings
- Environment information
- Default date range configuration
- KPI visibility controls
- Model cost references

## Development

### Adding New Pages

1. Create a new page in `app/[route]/page.tsx`
2. Add the route to the navigation in `components/layout/nav.tsx`
3. Add any new database functions to `lib/db.ts` if needed

### Styling

The app uses Tailwind CSS with a custom color scheme. Components follow the shadcn/ui design system patterns.

### Type Safety

All database types are defined in `lib/db.ts`. When wiring up real database queries, ensure the return types match these interfaces.

## Deployment

This app can be deployed to Vercel, Netlify, or any platform that supports Next.js.

1. Build the app:
   ```bash
   npm run build
   ```

2. Set environment variables as needed for your database connection

3. Deploy using your preferred platform

## Notes

- This dashboard is for internal use only (founders and ops)
- No mind-map content viewer is included - only metadata and usage metrics
- All database functions are placeholders and need to be wired to real queries
- The UI is designed with dark text on light background for readability

## Future Enhancements

- Real-time updates via WebSockets
- Export functionality for reports
- Advanced filtering and search
- Custom dashboard configuration
- Alerting and notifications

