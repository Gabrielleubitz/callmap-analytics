"use client"

/**
 * Ops Page - Redesigned with Better Visual Understanding
 * 
 * Improvements:
 * 1. Failed jobs shown prominently at top
 * 2. Better visual formatting with colors and icons
 * 3. Expandable error messages
 * 4. Filters to show only failed jobs
 * 5. Better descriptions explaining what each section means
 */

import { useState, useMemo } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatDate, formatNumber, formatDateTime } from "@/lib/utils"
import {
  getAIJobs,
  getAIJobStats,
  getWebhookEndpoints,
  getWebhookLogs,
  getIntegrationAnalytics,
  getSecurityAnalytics,
  DateRange,
} from "@/lib/db"
import { useApiData } from "@/lib/hooks/useApiData"
import { HeroMetricCard } from "@/components/metrics/hero-metric-card"
import { MetricGroupCard } from "@/components/metrics/metric-group-card"
import Link from "next/link"
import { AlertTriangle, Clock, Activity, CheckCircle, XCircle, Filter, ChevronDown, ChevronUp, Zap, FileText, Edit, Download, AlertCircle } from "lucide-react"

// Job type icons mapping
const JOB_TYPE_ICONS: Record<string, any> = {
  generate: Zap,
  transcribe: FileText,
  edit: Edit,
  export: Download,
}

// Job type descriptions
const JOB_TYPE_DESCRIPTIONS: Record<string, string> = {
  generate: "Generate mindmap from content",
  transcribe: "Transcribe audio/video to text",
  edit: "AI-powered mindmap editing",
  export: "Export mindmap to file",
}

export default function OpsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  })
  const [showOnlyFailed, setShowOnlyFailed] = useState(false)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  // Fetch all data using useApiData hook
  const aiJobs = useApiData(() => getAIJobs({ page: 1, pageSize: 200, ...dateRange }), [dateRange])
  const aiJobStats = useApiData(() => getAIJobStats(dateRange), [dateRange])
  const webhookEndpoints = useApiData(() => getWebhookEndpoints({ page: 1, pageSize: 100 }), [])
  const webhookLogs = useApiData(() => getWebhookLogs({ page: 1, pageSize: 100 }), [])
  const integrationAnalytics = useApiData(() => getIntegrationAnalytics(dateRange), [dateRange])
  const securityAnalytics = useApiData(() => getSecurityAnalytics(dateRange), [dateRange])

  // Extract arrays from paginated responses
  const aiJobsArray = aiJobs.data?.data || []
  const webhookEndpointsArray = webhookEndpoints.data?.data || []
  const webhookLogsArray = webhookLogs.data?.data || []

  // Calculate derived data
  const failedJobs = useMemo(() => 
    aiJobsArray.filter((j: any) => j.status === "failed"),
    [aiJobsArray]
  )
  const completedJobs = useMemo(() => 
    aiJobsArray.filter((j: any) => j.status === "completed"),
    [aiJobsArray]
  )
  const processingJobs = useMemo(() => 
    aiJobsArray.filter((j: any) => j.status === "processing" || j.status === "queued"),
    [aiJobsArray]
  )

  // Filter jobs based on toggle
  const displayedJobs = useMemo(() => {
    if (showOnlyFailed) return failedJobs
    // Sort: failed first, then by date (newest first)
    return [...aiJobsArray].sort((a: any, b: any) => {
      if (a.status === "failed" && b.status !== "failed") return -1
      if (a.status !== "failed" && b.status === "failed") return 1
      const aTime = a.finished_at || a.started_at || a.created_at
      const bTime = b.finished_at || b.started_at || b.created_at
      if (!aTime && !bTime) return 0
      if (!aTime) return 1
      if (!bTime) return -1
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }, [aiJobsArray, showOnlyFailed, failedJobs])

  const systemErrors = [
    ...failedJobs,
    ...(webhookLogsArray.filter((l: any) => l.status_code && l.status_code >= 400))
  ]

  const toggleErrorExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedErrors)
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId)
    } else {
      newExpanded.add(jobId)
    }
    setExpandedErrors(newExpanded)
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <p className="text-gray-600 text-sm max-w-3xl">
          Monitor system operations, AI job processing, webhook activity, and system errors. 
          Use this page to identify performance issues, failed jobs, and webhook problems that need attention.
        </p>
      </div>

      <Tabs defaultValue="ai-jobs">
        <TabsList className="mb-6">
          <TabsTrigger value="ai-jobs">AI Jobs</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="errors">System Errors</TabsTrigger>
        </TabsList>

        {/* AI Jobs Tab */}
        <TabsContent value="ai-jobs">
          {/* Hero Metrics */}
          {aiJobStats.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <LoadingState key={i} variant="card" />
              ))}
            </div>
          ) : aiJobStats.isError ? (
            <ErrorState
              title="Failed to load AI job stats"
              description={aiJobStats.error?.message}
              onRetry={aiJobStats.refetch}
            />
          ) : aiJobStats.data ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
              <HeroMetricCard
                title="Failed Jobs"
                value={formatNumber(failedJobs.length)}
                description={`${((failedJobs.length / aiJobsArray.length) * 100 || 0).toFixed(1)}% failure rate`}
                icon={<XCircle className="h-5 w-5 text-red-600" />}
              />
              <HeroMetricCard
                title="Completed"
                value={formatNumber(completedJobs.length)}
                description="Successfully finished"
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
              />
              <HeroMetricCard
                title="Processing"
                value={formatNumber(processingJobs.length)}
                description="Currently running"
                icon={<Clock className="h-5 w-5 text-yellow-600" />}
              />
              <HeroMetricCard
                title="Total Jobs"
                value={formatNumber(aiJobsArray.length || 0)}
                description="In selected period"
                icon={<Activity className="h-5 w-5" />}
              />
            </div>
          ) : null}

          {/* Failed Jobs Alert Banner */}
          {failedJobs.length > 0 && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 mb-1">
                        {failedJobs.length} Failed Job{failedJobs.length !== 1 ? 's' : ''} Detected
                      </h3>
                      <p className="text-sm text-red-700">
                        {failedJobs.length === 1 
                          ? "One AI job failed. Review the error message below to identify the issue."
                          : `${failedJobs.length} AI jobs failed. Review the errors below to identify patterns. Common causes: API errors, invalid input, quota limits, or network issues.`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={showOnlyFailed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowOnlyFailed(!showOnlyFailed)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    {showOnlyFailed ? "Show All" : "Show Only Failed"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Jobs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Processing Jobs</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    All AI operations that process mindmaps: generation, transcription, editing, and exports. 
                    Each job represents one AI API call. Failed jobs are highlighted in red. Click error messages to expand.
                  </p>
                </div>
                {failedJobs.length > 0 && (
                  <Badge variant="destructive" className="text-sm">
                    {failedJobs.length} Failed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {aiJobs.isLoading ? (
                <LoadingState variant="table" />
              ) : aiJobs.isError ? (
                <ErrorState
                  title="Failed to load AI jobs"
                  description={aiJobs.error?.message}
                  onRetry={aiJobs.refetch}
                />
              ) : displayedJobs.length === 0 ? (
                <EmptyState
                  title={showOnlyFailed ? "No failed jobs" : "No AI jobs"}
                  description={showOnlyFailed 
                    ? "Great! No jobs failed in this date range."
                    : "No AI jobs found in this date range."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Job Type</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Session ID</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Started</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Duration</th>
                        <th className="text-right py-3 px-3 font-semibold text-gray-700">Tokens</th>
                        <th className="text-right py-3 px-3 font-semibold text-gray-700">Cost</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Error Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedJobs.map((job: any) => {
                        const duration =
                          job.started_at && job.finished_at
                            ? Math.round(
                                (new Date(job.finished_at).getTime() -
                                  new Date(job.started_at).getTime()) /
                                  1000
                              )
                            : null
                        
                        const isFailed = job.status === "failed"
                        const isExpanded = expandedErrors.has(job.id)
                        const JobIcon = JOB_TYPE_ICONS[job.type] || Activity
                        const jobDescription = JOB_TYPE_DESCRIPTIONS[job.type] || job.type
                        const totalTokens = (job.tokens_in || 0) + (job.tokens_out || 0)

                        return (
                          <tr 
                            key={job.id} 
                            className={`border-b transition-colors ${
                              isFailed 
                                ? "bg-red-50 hover:bg-red-100" 
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <JobIcon className={`h-4 w-4 ${isFailed ? "text-red-600" : "text-gray-500"}`} />
                                <div>
                                  <Badge variant="outline" className={isFailed ? "border-red-300 text-red-700" : ""}>
                                    {job.type}
                                  </Badge>
                                  <div className="text-xs text-gray-500 mt-0.5">{jobDescription}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <Badge
                                variant={
                                  job.status === "completed"
                                    ? "default"
                                    : job.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="font-medium"
                              >
                                {job.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {job.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                                {job.status === "processing" && <Clock className="h-3 w-3 mr-1" />}
                                {job.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-3">
                              {job.session_id ? (
                                <Link 
                                  href={`/journeys?entityType=user&entityId=${job.session_id}`}
                                  className="font-mono text-xs text-blue-600 hover:underline"
                                >
                                  {job.session_id.slice(0, 12)}...
                                </Link>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {job.started_at ? (
                                <div className="text-xs">
                                  <div>{formatDate(job.started_at)}</div>
                                  <div className="text-gray-500">{formatDateTime(job.started_at).split(' ')[1]}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {duration !== null ? (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                  <span className={duration > 60 ? "text-orange-600 font-medium" : ""}>
                                    {duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {totalTokens > 0 ? (
                                <div className="text-xs">
                                  <div className="font-medium">{formatNumber(totalTokens)}</div>
                                  <div className="text-gray-500">
                                    {job.tokens_in && job.tokens_out 
                                      ? `${formatNumber(job.tokens_in)} in / ${formatNumber(job.tokens_out)} out`
                                      : ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {job.cost_usd ? (
                                <span className="font-medium">{formatCurrency(job.cost_usd)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {job.error_message ? (
                                <div className="max-w-md">
                                  <button
                                    onClick={() => toggleErrorExpansion(job.id)}
                                    className="flex items-start gap-2 text-left w-full group"
                                  >
                                    <div className={`flex-1 text-xs ${isFailed ? "text-red-700" : "text-gray-600"}`}>
                                      <div className={`font-medium mb-1 ${isFailed ? "text-red-900" : ""}`}>
                                        {isExpanded ? "Hide Error" : "Show Error"}
                                      </div>
                                      {isExpanded ? (
                                        <div className="bg-red-100 border border-red-200 rounded p-2 font-mono text-xs whitespace-pre-wrap break-words">
                                          {job.error_message}
                                        </div>
                                      ) : (
                                        <div className="truncate">
                                          {job.error_message.length > 60 
                                            ? `${job.error_message.substring(0, 60)}...`
                                            : job.error_message}
                                        </div>
                                      )}
                                    </div>
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0 group-hover:text-red-800" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks">
          {/* Hero Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
            <HeroMetricCard
              title="Endpoints"
              value={formatNumber(webhookEndpointsArray.length || 0)}
              icon={<Activity className="h-5 w-5" />}
            />
            <HeroMetricCard
              title="Total Logs"
              value={formatNumber(webhookLogsArray.length || 0)}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <HeroMetricCard
              title="Failed Logs"
              value={formatNumber(
                webhookLogsArray.filter((l: any) => l.status_code && l.status_code >= 400).length || 0
              )}
              icon={<XCircle className="h-5 w-5" />}
            />
          </div>

          {/* Webhook Endpoints */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Webhook Endpoints</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Configured webhook URLs that receive notifications when events occur (e.g., mindmap created, user signed up). 
                Monitor success rates to ensure webhooks are working. Low success rates indicate the endpoint may be down or rejecting requests.
              </p>
            </CardHeader>
            <CardContent>
              {webhookEndpoints.isLoading ? (
                <LoadingState variant="table" />
              ) : webhookEndpoints.isError ? (
                <ErrorState
                  title="Failed to load webhook endpoints"
                  description={webhookEndpoints.error?.message}
                  onRetry={webhookEndpoints.refetch}
                />
              ) : webhookEndpointsArray.length === 0 ? (
                <EmptyState
                  title="No webhook endpoints"
                  description="No webhook endpoints found."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Team</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">URL</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Events</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Success Rate</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Last Success</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Last Failure</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookEndpointsArray.map((endpoint: any) => {
                        const endpointLogs = webhookLogsArray.filter((l: any) => l.endpoint_id === endpoint.id)
                        const successCount = endpointLogs.filter((l: any) => l.status_code && l.status_code < 400).length
                        const successRate =
                          endpointLogs.length > 0 ? (successCount / endpointLogs.length) * 100 : 0

                        return (
                          <tr key={endpoint.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2">
                              <Link
                                href={`/teams/${endpoint.team_id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {endpoint.team_id}
                              </Link>
                            </td>
                            <td className="py-2 px-2 font-mono text-xs">{endpoint.url}</td>
                            <td className="py-2 px-2">{endpoint.event_types.join(", ")}</td>
                            <td className="py-2 px-2">
                              <Badge variant={successRate >= 95 ? "default" : "destructive"}>
                                {successRate.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="py-2 px-2">
                              {endpoint.last_success_at ? formatDate(endpoint.last_success_at) : "Never"}
                            </td>
                            <td className="py-2 px-2">
                              {endpoint.last_failure_at ? formatDate(endpoint.last_failure_at) : "Never"}
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant={endpoint.is_active ? "default" : "secondary"}>
                                {endpoint.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Delivery Logs</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                History of all webhook delivery attempts. Shows which webhooks succeeded (status 200-299) and which failed (400+). 
                Failed webhooks are retried automatically. Check error messages to see why deliveries failed.
              </p>
            </CardHeader>
            <CardContent>
              {webhookLogs.isLoading ? (
                <LoadingState variant="table" />
              ) : webhookLogs.isError ? (
                <ErrorState
                  title="Failed to load webhook logs"
                  description={webhookLogs.error?.message}
                  onRetry={webhookLogs.refetch}
                />
              ) : webhookLogsArray.length === 0 ? (
                <EmptyState
                  title="No webhook logs"
                  description="No webhook logs found."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Endpoint</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Status</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Attempted</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Latency</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookLogsArray.map((log: any) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-mono text-xs">{log.endpoint_id.slice(0, 8)}</td>
                          <td className="py-2 px-2">
                            <Badge
                              variant={
                                log.status_code && log.status_code < 400 ? "default" : "destructive"
                              }
                            >
                              {log.status_code || "N/A"}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">{formatDate(log.attempted_at)}</td>
                          <td className="py-2 px-2">
                            {log.latency_ms ? `${log.latency_ms}ms` : "-"}
                          </td>
                          <td className="py-2 px-2">
                            {log.error_message ? (
                              <span className="text-xs text-red-600">{log.error_message}</span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          {/* Hero Metrics */}
          {integrationAnalytics.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <LoadingState key={i} variant="card" />
              ))}
            </div>
          ) : integrationAnalytics.isError ? (
            <ErrorState
              title="Failed to load integration analytics"
              description={integrationAnalytics.error?.message}
              onRetry={integrationAnalytics.refetch}
            />
          ) : integrationAnalytics.data ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
                <HeroMetricCard
                  title="Total Integrations"
                  value={formatNumber(integrationAnalytics.data.totalIntegrations)}
                  icon={<Activity className="h-5 w-5" />}
                />
                <HeroMetricCard
                  title="Active Integrations"
                  value={formatNumber(integrationAnalytics.data.activeIntegrations)}
                  icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                />
                <HeroMetricCard
                  title="Integration Errors"
                  value={formatNumber(integrationAnalytics.data.totalErrors)}
                  icon={<XCircle className="h-5 w-5 text-red-600" />}
                />
                <HeroMetricCard
                  title="Error Rate"
                  value={`${integrationAnalytics.data.errorRate.toFixed(1)}%`}
                  icon={<AlertTriangle className="h-5 w-5" />}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Integrations by Provider</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(integrationAnalytics.data.integrationsByProvider || {}).length === 0 ? (
                      <EmptyState title="No integrations" description="No integrations found." />
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(integrationAnalytics.data.integrationsByProvider).map(([provider, count]) => (
                          <div key={provider} className="flex items-center justify-between p-2 rounded-lg border">
                            <span className="font-medium capitalize">{provider.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{formatNumber(count as number)}</Badge>
                              {integrationAnalytics.data.activeIntegrationsByProvider[provider] && (
                                <Badge variant="default" className="text-xs">
                  Active: {formatNumber(integrationAnalytics.data.activeIntegrationsByProvider[provider])}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Integration Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MetricGroupCard
                      title=""
                      metrics={[
                        { label: "Sync Success Rate", value: `${integrationAnalytics.data.syncSuccessRate.toFixed(1)}%` },
                        { label: "Webhook Events Received", value: formatNumber(integrationAnalytics.data.webhookEventsReceived) },
                        { label: "Webhook Events Processed", value: formatNumber(integrationAnalytics.data.webhookEventsProcessed) },
                        { label: "Webhook Events Failed", value: formatNumber(integrationAnalytics.data.webhookEventsFailed) },
                      ]}
                    />
                  </CardContent>
                </Card>
              </div>

              {Object.keys(integrationAnalytics.data.errorsByProvider || {}).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Errors by Provider</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(integrationAnalytics.data.errorsByProvider)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([provider, count]) => (
                          <div key={provider} className="flex items-center justify-between p-2 rounded-lg border border-red-200 bg-red-50">
                            <span className="font-medium capitalize text-red-900">{provider.replace(/_/g, ' ')}</span>
                            <Badge variant="destructive">{formatNumber(count as number)}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          {/* Hero Metrics */}
          {securityAnalytics.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <LoadingState key={i} variant="card" />
              ))}
            </div>
          ) : securityAnalytics.isError ? (
            <ErrorState
              title="Failed to load security analytics"
              description={securityAnalytics.error?.message}
              onRetry={securityAnalytics.refetch}
            />
          ) : securityAnalytics.data ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
                <HeroMetricCard
                  title="Failed Logins"
                  value={formatNumber(securityAnalytics.data.failedLoginAttempts)}
                  icon={<XCircle className="h-5 w-5 text-red-600" />}
                />
                <HeroMetricCard
                  title="Security Incidents"
                  value={formatNumber(securityAnalytics.data.securityIncidents)}
                  icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
                />
                <HeroMetricCard
                  title="Audit Logs"
                  value={formatNumber(securityAnalytics.data.auditLogCount)}
                  icon={<Activity className="h-5 w-5" />}
                />
                <HeroMetricCard
                  title="Suspicious Activity"
                  value={formatNumber(securityAnalytics.data.suspiciousActivityCount)}
                  icon={<AlertCircle className="h-5 w-5 text-red-600" />}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Incidents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {securityAnalytics.data.securityIncidents === 0 ? (
                      <EmptyState title="No incidents" description="No security incidents in this period." />
                    ) : (
                      <div className="space-y-4">
                        {Object.keys(securityAnalytics.data.incidentsBySeverity || {}).length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">By Severity:</div>
                            {Object.entries(securityAnalytics.data.incidentsBySeverity).map(([severity, count]) => (
                              <div key={severity} className="flex items-center justify-between p-2 rounded-lg border mb-2">
                                <span className="font-medium capitalize">{severity}</span>
                                <Badge variant={severity === 'P0' || severity === 'P1' ? 'destructive' : 'secondary'}>
                                  {formatNumber(count as number)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                        {Object.keys(securityAnalytics.data.incidentsByType || {}).length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">By Type:</div>
                            {Object.entries(securityAnalytics.data.incidentsByType).map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between p-2 rounded-lg border mb-2">
                                <span className="font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                                <Badge variant="outline">{formatNumber(count as number)}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Audit Logs & Compliance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MetricGroupCard
                      title=""
                      metrics={[
                        { label: "Total Audit Logs", value: formatNumber(securityAnalytics.data.auditLogCount) },
                        { label: "Data Deletion Requests", value: formatNumber(securityAnalytics.data.dataDeletionRequests) },
                        { label: "Suspicious Activity", value: formatNumber(securityAnalytics.data.suspiciousActivityCount) },
                      ]}
                    />
                    {Object.keys(securityAnalytics.data.deletionRequestsByStatus || {}).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-sm font-medium text-gray-700 mb-2">Deletion Requests by Status:</div>
                        {Object.entries(securityAnalytics.data.deletionRequestsByStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between text-sm mb-1">
                            <span className="capitalize">{status}</span>
                            <Badge variant="outline">{formatNumber(count as number)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* System Errors Tab */}
        <TabsContent value="errors">
          {/* Hero Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
            <HeroMetricCard
              title="Failed AI Jobs"
              value={formatNumber(failedJobs.length)}
              description="AI processing jobs that failed"
              icon={<XCircle className="h-5 w-5 text-red-600" />}
            />
            <HeroMetricCard
              title="Failed Webhooks"
              value={formatNumber(
                webhookLogsArray.filter((l: any) => l.status_code && l.status_code >= 400).length || 0
              )}
              description="Webhook calls that returned errors"
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            />
          </div>

          {/* System Errors Table */}
          <Card>
            <CardHeader>
              <CardTitle>All System Errors</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Combined view of all failed AI jobs and failed webhook calls. Use this to identify patterns in errors 
                and prioritize fixes. Errors are sorted by most recent first.
              </p>
            </CardHeader>
            <CardContent>
              {systemErrors.length === 0 ? (
                <EmptyState
                  title="No system errors"
                  description="Great! No errors found in this date range. All AI jobs and webhooks are working correctly."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Error Type</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">ID</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Error Message</th>
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemErrors
                        .sort((a: any, b: any) => {
                          const aTime = a.finished_at || a.attempted_at || a.created_at
                          const bTime = b.finished_at || b.attempted_at || b.created_at
                          if (!aTime && !bTime) return 0
                          if (!aTime) return 1
                          if (!bTime) return -1
                          return new Date(bTime).getTime() - new Date(aTime).getTime()
                        })
                        .map((error: any) => {
                          const isExpanded = expandedErrors.has(error.id)
                          const errorType = error.type || (error.status_code ? "webhook" : "ai_job")
                          
                          return (
                            <tr key={error.id} className="border-b bg-red-50 hover:bg-red-100">
                              <td className="py-3 px-3">
                                <Badge variant="destructive" className="font-medium">
                                  {errorType === "ai_job" && <Zap className="h-3 w-3 mr-1" />}
                                  {errorType === "webhook" && <Activity className="h-3 w-3 mr-1" />}
                                  {errorType}
                                </Badge>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-mono text-xs">{error.id.slice(0, 12)}...</span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="max-w-lg">
                                  <button
                                    onClick={() => toggleErrorExpansion(error.id)}
                                    className="flex items-start gap-2 text-left w-full group"
                                  >
                                    <div className="flex-1 text-xs text-red-700">
                                      {isExpanded ? (
                                        <div className="bg-red-100 border border-red-200 rounded p-2 font-mono text-xs whitespace-pre-wrap break-words">
                                          {error.error_message || error.status_code || "Unknown error"}
                                        </div>
                                      ) : (
                                        <div className="truncate font-medium">
                                          {error.error_message || error.status_code || "Unknown error"}
                                        </div>
                                      )}
                                    </div>
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0 group-hover:text-red-800" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-xs">
                                  <div>{formatDate(error.finished_at || error.attempted_at || error.created_at)}</div>
                                  <div className="text-gray-500">
                                    {formatDateTime(error.finished_at || error.attempted_at || error.created_at).split(' ')[1]}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
