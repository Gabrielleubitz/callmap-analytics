"use client"

import { useState, useEffect } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils"
import {
  getAIJobs,
  getAIJobStats,
  getWebhookEndpoints,
  getWebhookLogs,
  DateRange,
} from "@/lib/db"
import Link from "next/link"

export default function OpsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  })
  const [aiJobs, setAIJobs] = useState<any[]>([])
  const [aiJobStats, setAIJobStats] = useState<any>(null)
  const [webhookEndpoints, setWebhookEndpoints] = useState<any[]>([])
  const [webhookLogs, setWebhookLogs] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [jobs, stats, endpoints, logs] = await Promise.all([
        getAIJobs({ page: 1, pageSize: 100, ...dateRange }),
        getAIJobStats(dateRange),
        getWebhookEndpoints({ page: 1, pageSize: 100 }),
        getWebhookLogs({ page: 1, pageSize: 100 }),
      ])
      setAIJobs(jobs.data)
      setAIJobStats(stats)
      setWebhookEndpoints(endpoints.data)
      setWebhookLogs(logs.data)
    }
    load()
  }, [dateRange])

  const failedJobs = aiJobs.filter((j) => j.status === "failed")
  const systemErrors = [...failedJobs, ...webhookLogs.filter((l) => l.status_code && l.status_code >= 400)]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Ops</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <Tabs defaultValue="ai-jobs">
        <TabsList>
          <TabsTrigger value="ai-jobs">AI Jobs</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="errors">System Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-jobs">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Failure Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(aiJobStats?.failureRate || 0).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Longest Running Job</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {aiJobStats?.longestRunningJob
                    ? `${(aiJobStats.longestRunningJob / 60).toFixed(1)}m`
                    : "-"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiJobs.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiJobs.map((job) => {
                    const duration =
                      job.started_at && job.finished_at
                        ? Math.round(
                            (new Date(job.finished_at).getTime() -
                              new Date(job.started_at).getTime()) /
                              1000
                          )
                        : null

                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Badge variant="outline">{job.type}</Badge>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          {job.session_id ? (
                            <span className="font-mono text-xs">{job.session_id.slice(0, 8)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {job.started_at ? formatDate(job.started_at) : "-"}
                        </TableCell>
                        <TableCell>
                          {job.finished_at ? formatDate(job.finished_at) : "-"}
                        </TableCell>
                        <TableCell>
                          {duration !== null ? `${duration}s` : "-"}
                        </TableCell>
                        <TableCell>
                          {job.cost_usd ? formatCurrency(job.cost_usd) : "-"}
                        </TableCell>
                        <TableCell>
                          {job.error_message ? (
                            <span className="text-xs text-red-600">{job.error_message}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Webhook Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Last Success</TableHead>
                    <TableHead>Last Failure</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookEndpoints.map((endpoint) => {
                    const endpointLogs = webhookLogs.filter((l) => l.endpoint_id === endpoint.id)
                    const successCount = endpointLogs.filter((l) => l.status_code && l.status_code < 400).length
                    const successRate =
                      endpointLogs.length > 0 ? (successCount / endpointLogs.length) * 100 : 0

                    return (
                      <TableRow key={endpoint.id}>
                        <TableCell>
                          <Link
                            href={`/teams/${endpoint.team_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {endpoint.team_id}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{endpoint.url}</TableCell>
                        <TableCell>{endpoint.event_types.join(", ")}</TableCell>
                        <TableCell>
                          <Badge variant={successRate >= 95 ? "default" : "destructive"}>
                            {successRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {endpoint.last_success_at ? formatDate(endpoint.last_success_at) : "Never"}
                        </TableCell>
                        <TableCell>
                          {endpoint.last_failure_at ? formatDate(endpoint.last_failure_at) : "Never"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={endpoint.is_active ? "default" : "secondary"}>
                            {endpoint.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempted</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.endpoint_id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status_code && log.status_code < 400 ? "default" : "destructive"
                          }
                        >
                          {log.status_code || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(log.attempted_at)}</TableCell>
                      <TableCell>
                        {log.latency_ms ? `${log.latency_ms}ms` : "-"}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <span className="text-xs text-red-600">{log.error_message}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>System Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systemErrors.map((error) => (
                    <TableRow key={error.id}>
                      <TableCell>
                        <Badge variant="destructive">
                          {error.type || "webhook"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{error.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-red-600">
                          {error.error_message || error.status_code || "Unknown error"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDate(error.finished_at || error.attempted_at || error.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

