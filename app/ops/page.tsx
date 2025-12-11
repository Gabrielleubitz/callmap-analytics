"use client"

/**
 * Ops Page - Redesigned
 * 
 * New layout structure:
 * 1. Hero metrics per tab (AI Jobs, Webhooks, System Errors)
 * 2. Better organization with consistent styling
 * 3. Loading/Error/Empty states
 * 4. Consistent table styling
 */

import { useState } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils"
import {
  getAIJobs,
  getAIJobStats,
  getWebhookEndpoints,
  getWebhookLogs,
  DateRange,
} from "@/lib/db"
import { useApiData } from "@/lib/hooks/useApiData"
import { HeroMetricCard } from "@/components/metrics/hero-metric-card"
import Link from "next/link"
import { AlertTriangle, Clock, Activity, CheckCircle, XCircle } from "lucide-react"

export default function OpsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  })

  // Fetch all data using useApiData hook
  const aiJobs = useApiData(() => getAIJobs({ page: 1, pageSize: 100, ...dateRange }), [dateRange])
  const aiJobStats = useApiData(() => getAIJobStats(dateRange), [dateRange])
  const webhookEndpoints = useApiData(() => getWebhookEndpoints({ page: 1, pageSize: 100 }), [])
  const webhookLogs = useApiData(() => getWebhookLogs({ page: 1, pageSize: 100 }), [])

  // Extract arrays from paginated responses
  const aiJobsArray = aiJobs.data?.data || []
  const webhookEndpointsArray = webhookEndpoints.data?.data || []
  const webhookLogsArray = webhookLogs.data?.data || []

  // Calculate derived data
  const failedJobs = aiJobsArray.filter((j: any) => j.status === "failed")
  const systemErrors = [
    ...failedJobs,
    ...(webhookLogsArray.filter((l: any) => l.status_code && l.status_code >= 400))
  ]

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Ops</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <Tabs defaultValue="ai-jobs">
        <TabsList className="mb-6">
          <TabsTrigger value="ai-jobs">AI Jobs</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="errors">System Errors</TabsTrigger>
        </TabsList>

        {/* AI Jobs Tab */}
        <TabsContent value="ai-jobs">
          {/* Hero Metrics */}
          {aiJobStats.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
              {[1, 2, 3].map((i) => (
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
              <HeroMetricCard
                title="Failure Rate"
                value={`${(aiJobStats.data.failureRate || 0).toFixed(1)}%`}
                icon={<AlertTriangle className="h-5 w-5" />}
                description="Failed jobs percentage"
              />
              <HeroMetricCard
                title="Longest Running Job"
                value={aiJobStats.data.longestRunningJob
                  ? `${(aiJobStats.data.longestRunningJob / 60).toFixed(1)}m`
                  : "-"}
                icon={<Clock className="h-5 w-5" />}
                description="Maximum duration"
              />
              <HeroMetricCard
                title="Total Jobs"
                value={formatNumber(aiJobsArray.length || 0)}
                icon={<Activity className="h-5 w-5" />}
                description="Jobs in date range"
              />
            </div>
          ) : null}

          {/* AI Jobs Table */}
          <Card>
            <CardHeader>
              <CardTitle>AI Jobs</CardTitle>
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
              ) : aiJobsArray.length === 0 ? (
                <EmptyState
                  title="No AI jobs"
                  description="No AI jobs found in this date range."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Type</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Status</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Session</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Started</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Finished</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Duration</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">Cost</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiJobsArray.map((job: any) => {
                        const duration =
                          job.started_at && job.finished_at
                            ? Math.round(
                                (new Date(job.finished_at).getTime() -
                                  new Date(job.started_at).getTime()) /
                                  1000
                              )
                            : null

                        return (
                          <tr key={job.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2">
                              <Badge variant="outline">{job.type}</Badge>
                            </td>
                            <td className="py-2 px-2">
                              <Badge
                                variant={
                                  job.status === "completed"
                                    ? "default"
                                    : job.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {job.status}
                              </Badge>
                            </td>
                            <td className="py-2 px-2">
                              {job.session_id ? (
                                <span className="font-mono text-xs">{job.session_id.slice(0, 8)}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {job.started_at ? formatDate(job.started_at) : "-"}
                            </td>
                            <td className="py-2 px-2">
                              {job.finished_at ? formatDate(job.finished_at) : "-"}
                            </td>
                            <td className="py-2 px-2">
                              {duration !== null ? `${duration}s` : "-"}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {job.cost_usd ? formatCurrency(job.cost_usd) : "-"}
                            </td>
                            <td className="py-2 px-2">
                              {job.error_message ? (
                                <span className="text-xs text-red-600">{job.error_message}</span>
                              ) : (
                                "-"
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
              description="Total webhook endpoints"
            />
            <HeroMetricCard
              title="Total Logs"
              value={formatNumber(webhookLogsArray.length || 0)}
              icon={<CheckCircle className="h-5 w-5" />}
              description="Webhook delivery logs"
            />
            <HeroMetricCard
              title="Failed Logs"
              value={formatNumber(
                webhookLogsArray.filter((l: any) => l.status_code && l.status_code >= 400).length || 0
              )}
              icon={<XCircle className="h-5 w-5" />}
              description="Failed deliveries"
            />
          </div>

          {/* Webhook Endpoints */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Webhook Endpoints</CardTitle>
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
              <CardTitle>Webhook Logs</CardTitle>
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

        {/* System Errors Tab */}
        <TabsContent value="errors">
          {/* Hero Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
            <HeroMetricCard
              title="Failed Jobs"
              value={formatNumber(failedJobs.length)}
              icon={<AlertTriangle className="h-5 w-5" />}
              description="AI jobs that failed"
            />
            <HeroMetricCard
              title="Failed Webhooks"
              value={formatNumber(
                webhookLogsArray.filter((l: any) => l.status_code && l.status_code >= 400).length || 0
              )}
              icon={<XCircle className="h-5 w-5" />}
              description="Webhook delivery failures"
            />
          </div>

          {/* System Errors Table */}
          <Card>
            <CardHeader>
              <CardTitle>System Errors</CardTitle>
            </CardHeader>
            <CardContent>
              {systemErrors.length === 0 ? (
                <EmptyState
                  title="No system errors"
                  description="No system errors found in this date range."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Type</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">ID</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Error</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemErrors.map((error: any) => (
                        <tr key={error.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2">
                            <Badge variant="destructive">
                              {error.type || "webhook"}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">{error.id.slice(0, 8)}</td>
                          <td className="py-2 px-2">
                            <span className="text-xs text-red-600">
                              {error.error_message || error.status_code || "Unknown error"}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {formatDate(error.finished_at || error.attempted_at || error.created_at)}
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
      </Tabs>
    </div>
  )
}
