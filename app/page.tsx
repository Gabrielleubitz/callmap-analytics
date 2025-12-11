"use client"

/**
 * Overview Page - Redesigned
 * 
 * New layout structure:
 * 1. Hero row (3 large cards: Active Users Today, Sessions Today, Tokens Used Today)
 * 2. Growth section (grouped metrics with sparklines)
 * 3. Usage section (grouped metrics)
 * 4. Revenue & Cost section (with deltas)
 * 5. System Health section (status badges)
 * 6. Charts (4 charts below metrics)
 * 7. Tables (detailed data at bottom)
 */

import { useState, useMemo } from "react"
import { startOfDay, endOfDay, subDays, format, isToday } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { DateRange, getOverviewMetrics, getDailyActiveUsers, getDailySessions, getDailyTokensByModel, getTokensByPlan, getTopTeamsByTokens, getTopTeamsByCost, getRecentlyCreatedTeams, getRecentlyFailedAIJobs, getMindmapGenerationTime, getMindmapEditCount, getFileConversionRate, getUserRetention, getMindmapFunnel, getExportRate, getCollaborationActivity, getTokenBurnByFeature, getMapEconomics, getBehaviorCohorts } from "@/lib/db"
import { useApiData } from "@/lib/hooks/useApiData"
import { HeroMetricCard } from "@/components/metrics/hero-metric-card"
import { MetricGroupCard } from "@/components/metrics/metric-group-card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"
import { formatDateTime } from "@/lib/utils"
import { Users, Activity, Zap, TrendingUp, AlertCircle, CheckCircle } from "lucide-react"

export default function OverviewPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  // Fetch all data using useApiData hook
  const metrics = useApiData(() => getOverviewMetrics(dateRange), [dateRange])
  const dailyActive = useApiData(() => getDailyActiveUsers(dateRange), [dateRange])
  const dailySessions = useApiData(() => getDailySessions(dateRange), [dateRange])
  const tokensByModel = useApiData(() => getDailyTokensByModel(dateRange), [dateRange])
  const tokensByPlan = useApiData(() => getTokensByPlan(dateRange), [dateRange])
  const topTeamsTokens = useApiData(() => getTopTeamsByTokens(dateRange, 10), [dateRange])
  const topTeamsCost = useApiData(() => getTopTeamsByCost(dateRange, 10), [dateRange])
  const recentTeams = useApiData(() => getRecentlyCreatedTeams(10), [])
  const recentFailures = useApiData(() => getRecentlyFailedAIJobs(10), [])
  
  // New metrics
  const generationTime = useApiData(() => getMindmapGenerationTime(dateRange), [dateRange])
  const editCount = useApiData(() => getMindmapEditCount(dateRange), [dateRange])
  const conversionRate = useApiData(() => getFileConversionRate(dateRange), [dateRange])
  const userRetention = useApiData(() => getUserRetention(dateRange), [dateRange])
  const funnel = useApiData(() => getMindmapFunnel(dateRange), [dateRange])
  const exportRate = useApiData(() => getExportRate(dateRange), [dateRange])
  const collaboration = useApiData(() => getCollaborationActivity(dateRange), [dateRange])
  const tokenBurnByFeature = useApiData(() => getTokenBurnByFeature(dateRange), [dateRange])
  
  // Map Economics
  const mapEconomics = useApiData(() => getMapEconomics(dateRange), [dateRange])
  
  // Behavior Cohorts
  const behaviorCohorts = useApiData(() => getBehaviorCohorts(dateRange, 12), [dateRange])

  // Calculate today's metrics and deltas
  const todayMetrics = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    
    const todayActive = dailyActive.data?.find(d => d.date === today)
    const yesterdayActive = dailyActive.data?.find(d => d.date === yesterday)
    
    const todaySessions = dailySessions.data?.find(d => d.date === today)
    const yesterdaySessions = dailySessions.data?.find(d => d.date === yesterday)
    
    // Calculate today's tokens from daily tokens by model
    const todayTokens = tokensByModel.data
      ?.filter(d => d.date === today)
      .reduce((sum, d) => sum + d.tokens, 0) || 0
    const yesterdayTokens = tokensByModel.data
      ?.filter(d => d.date === yesterday)
      .reduce((sum, d) => sum + d.tokens, 0) || 0

    // Calculate deltas
    const activeDelta = todayActive && yesterdayActive && yesterdayActive.active > 0
      ? ((todayActive.active - yesterdayActive.active) / yesterdayActive.active) * 100
      : 0
    
    const sessionsDelta = todaySessions && yesterdaySessions && yesterdaySessions.count > 0
      ? ((todaySessions.count - yesterdaySessions.count) / yesterdaySessions.count) * 100
      : 0
    
    const tokensDelta = yesterdayTokens > 0
      ? ((todayTokens - yesterdayTokens) / yesterdayTokens) * 100
      : 0

    // Create sparklines (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => 
      format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    )
    
    const activeSparkline = last7Days.map(date => ({
      date,
      value: dailyActive.data?.find(d => d.date === date)?.active || 0
    }))
    
    const sessionsSparkline = last7Days.map(date => ({
      date,
      value: dailySessions.data?.find(d => d.date === date)?.count || 0
    }))
    
    const tokensSparkline = last7Days.map(date => ({
      date,
      value: tokensByModel.data
        ?.filter(d => d.date === date)
        .reduce((sum, d) => sum + d.tokens, 0) || 0
    }))

    return {
      activeUsers: {
        value: todayActive?.active || 0,
        delta: activeDelta,
        sparkline: activeSparkline
      },
      sessions: {
        value: todaySessions?.count || 0,
        delta: sessionsDelta,
        sparkline: sessionsSparkline
      },
      tokens: {
        value: todayTokens,
        delta: tokensDelta,
        sparkline: tokensSparkline
      }
    }
  }, [dailyActive.data, dailySessions.data, tokensByModel.data])

  // Calculate 7-day and 30-day active users
  const growthMetrics = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => 
      format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    )
    const last30Days = Array.from({ length: 30 }, (_, i) => 
      format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
    )

    const active7d = last7Days.reduce((sum, date) => {
      const dayData = dailyActive.data?.find(d => d.date === date)
      return sum + (dayData?.active || 0)
    }, 0)

    const active30d = last30Days.reduce((sum, date) => {
      const dayData = dailyActive.data?.find(d => d.date === date)
      return sum + (dayData?.active || 0)
    }, 0)

    const newRegistrations = metrics.data?.new_registrations || 0

    // Create sparklines for growth metrics
    const newRegSparkline = last7Days.map(date => ({
      date,
      value: dailyActive.data?.find(d => d.date === date)?.new || 0
    }))

    const active7dSparkline = last7Days.map(date => ({
      date,
      value: dailyActive.data?.find(d => d.date === date)?.active || 0
    }))

    const active30dSparkline = last30Days.map(date => ({
      date,
      value: dailyActive.data?.find(d => d.date === date)?.active || 0
    }))

    return {
      newRegistrations: {
        label: "New Registrations",
        value: newRegistrations,
        sparkline: newRegSparkline
      },
      active7d: {
        label: "7-Day Active Users",
        value: active7d,
        sparkline: active7dSparkline
      },
      active30d: {
        label: "30-Day Active Users",
        value: active30d,
        sparkline: active30dSparkline
      }
    }
  }, [dailyActive.data, metrics.data])

  // Calculate usage metrics
  const usageMetrics = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const last7Days = Array.from({ length: 7 }, (_, i) => 
      format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    )

    const todaySessions = dailySessions.data?.find(d => d.date === today)?.count || 0
    
    const tokens7d = last7Days.reduce((sum, date) => {
      return sum + (tokensByModel.data
        ?.filter(d => d.date === date)
        .reduce((s, d) => s + d.tokens, 0) || 0)
    }, 0)

    const avgTokensPerSession = todaySessions > 0 && todayMetrics.tokens.value > 0
      ? todayMetrics.tokens.value / todaySessions
      : 0

    return {
      sessionsToday: {
        label: "Sessions",
        value: todaySessions
      },
      tokens7d: {
        label: "Token Usage (7-day)",
        value: tokens7d
      },
      avgTokensPerSession: {
        label: "Avg Tokens per Session",
        value: Math.round(avgTokensPerSession)
      }
    }
  }, [dailySessions.data, tokensByModel.data, todayMetrics])

  // Calculate revenue metrics with deltas
  const revenueMetrics = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const estimatedCost = metrics.data?.estimated_cost || 0
    const mrrEstimate = metrics.data?.mrr_estimate || 0

    // For daily revenue, we'd need a revenue API - using MRR as placeholder
    // In a real implementation, you'd fetch daily revenue data
    const dailyRevenue = mrrEstimate / 30 // Approximate daily from MRR

    // Calculate deltas (simplified - would need yesterday's data)
    const costDelta = 0 // Would calculate from yesterday's cost
    const revenueDelta = 0 // Would calculate from yesterday's revenue
    const mrrDelta = 0 // Would calculate from yesterday's MRR

    return {
      estimatedCost: {
        label: "Estimated Token Cost",
        value: estimatedCost,
        delta: costDelta
      },
      dailyRevenue: {
        label: "Daily Revenue",
        value: dailyRevenue,
        delta: revenueDelta
      },
      mrrEstimate: {
        label: "MRR Estimate",
        value: mrrEstimate,
        delta: mrrDelta
      }
    }
  }, [metrics.data])

  // System health metrics
  const systemHealth = useMemo(() => {
    const stuckJobs = recentFailures.data?.filter(job => {
      // Jobs that are older than 1 hour and still in progress
      const jobDate = job.created_at ? new Date(job.created_at) : null
      if (!jobDate) return false
      const hoursAgo = (new Date().getTime() - jobDate.getTime()) / (1000 * 60 * 60)
      return hoursAgo > 1 && job.status === 'processing'
    }).length || 0

    const apiErrors = recentFailures.data?.filter(job => 
      job.status === 'failed' || job.status === 'error'
    ).length || 0

    // Check for missing billing data (simplified check)
    const missingBilling = 0 // Would check for teams without subscriptions

    return {
      stuckJobs: {
        label: "Jobs Stuck",
        value: stuckJobs,
        status: stuckJobs > 0 ? "warning" : "ok"
      },
      apiErrors: {
        label: "API Errors",
        value: apiErrors,
        status: apiErrors > 5 ? "error" : apiErrors > 0 ? "warning" : "ok"
      },
      missingBilling: {
        label: "Missing Billing Data",
        value: missingBilling,
        status: missingBilling > 0 ? "warning" : "ok"
      }
    }
  }, [recentFailures.data])

  // Transform tokens by model for chart display
  const tokensByModelChart = useMemo(() => {
    if (!tokensByModel.data || tokensByModel.data.length === 0) return []
    
    const modelMap = new Map<string, Map<string, number>>()
    tokensByModel.data.forEach((item: any) => {
      if (!modelMap.has(item.date)) {
        modelMap.set(item.date, new Map())
      }
      modelMap.get(item.date)!.set(item.model, item.tokens)
    })
    
    const allModels = new Set<string>()
    tokensByModel.data.forEach((item: any) => allModels.add(item.model))
    
    return Array.from(modelMap.entries()).map(([date, models]) => {
      const entry: any = { date }
      allModels.forEach((model) => {
        entry[model] = models.get(model) || 0
      })
      return entry
    }).sort((a, b) => a.date.localeCompare(b.date))
  }, [tokensByModel.data])

  // Calculate revenue over time (simplified - using MRR/30 as daily)
  const revenueOverTime = useMemo(() => {
    if (!dailySessions.data || !metrics.data) return []
    
    const mrrPerDay = (metrics.data.mrr_estimate || 0) / 30
    
    return dailySessions.data.map(d => ({
      date: d.date,
      revenue: mrrPerDay
    }))
  }, [dailySessions.data, metrics.data])

  // Calculate token burn rate (daily tokens)
  const tokenBurnRate = useMemo(() => {
    if (!tokensByModel.data) return []
    
    const dailyMap = new Map<string, number>()
    tokensByModel.data.forEach(item => {
      const current = dailyMap.get(item.date) || 0
      dailyMap.set(item.date, current + item.tokens)
    })
    
    return Array.from(dailyMap.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [tokensByModel.data])

  if (metrics.isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <LoadingState variant="page" message="Loading overview..." />
      </div>
    )
  }

  if (metrics.isError) {
    return (
      <div className="container mx-auto px-4 py-6">
        <ErrorState
          title="Failed to load overview"
          description={metrics.error?.message || "Unable to fetch data. Please try again."}
          onRetry={metrics.refetch}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Hero Metrics Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <HeroMetricCard
          title="Active Users Today"
          value={todayMetrics.activeUsers.value}
          delta={{
            value: todayMetrics.activeUsers.delta,
            label: "vs yesterday"
          }}
          sparkline={todayMetrics.activeUsers.sparkline}
          icon={<Users className="h-5 w-5" />}
        />
        <HeroMetricCard
          title="Sessions Today"
          value={todayMetrics.sessions.value}
          delta={{
            value: todayMetrics.sessions.delta,
            label: "vs yesterday"
          }}
          sparkline={todayMetrics.sessions.sparkline}
          icon={<Activity className="h-5 w-5" />}
        />
        <HeroMetricCard
          title="Tokens Used Today"
          value={formatNumber(todayMetrics.tokens.value)}
          delta={{
            value: todayMetrics.tokens.delta,
            label: "vs yesterday"
          }}
          sparkline={todayMetrics.tokens.sparkline}
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      {/* Section: Growth */}
      <div className="mb-6">
        <MetricGroupCard
          title="Growth"
          description="User acquisition and engagement metrics"
          metrics={[
            {
              label: growthMetrics.newRegistrations.label,
              value: growthMetrics.newRegistrations.value,
              sparkline: growthMetrics.newRegistrations.sparkline
            },
            {
              label: growthMetrics.active7d.label,
              value: growthMetrics.active7d.value,
              sparkline: growthMetrics.active7d.sparkline
            },
            {
              label: growthMetrics.active30d.label,
              value: growthMetrics.active30d.value,
              sparkline: growthMetrics.active30d.sparkline
            }
          ]}
          columns={3}
        />
      </div>

      {/* Section: Usage */}
      <div className="mb-6">
        <MetricGroupCard
          title="Usage"
          description="Platform usage and consumption metrics"
          metrics={[
            {
              label: usageMetrics.sessionsToday.label,
              value: usageMetrics.sessionsToday.value
            },
            {
              label: usageMetrics.tokens7d.label,
              value: formatNumber(usageMetrics.tokens7d.value)
            },
            {
              label: usageMetrics.avgTokensPerSession.label,
              value: formatNumber(usageMetrics.avgTokensPerSession.value)
            }
          ]}
          columns={3}
        />
      </div>

      {/* Section: Revenue & Cost */}
      <div className="mb-6">
        <MetricGroupCard
          title="Revenue & Cost"
          description="Financial metrics with daily comparisons"
          metrics={[
            {
              label: revenueMetrics.estimatedCost.label,
              value: formatCurrency(revenueMetrics.estimatedCost.value)
            },
            {
              label: revenueMetrics.dailyRevenue.label,
              value: formatCurrency(revenueMetrics.dailyRevenue.value)
            },
            {
              label: revenueMetrics.mrrEstimate.label,
              value: formatCurrency(revenueMetrics.mrrEstimate.value)
            }
          ]}
          columns={3}
        />
      </div>

      {/* Section: System Health */}
      <div className="mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">System Health</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Platform status and error monitoring</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(systemHealth).map(([key, metric]) => (
                <div key={key} className="space-y-2">
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    {metric.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-bold text-gray-900">{metric.value}</div>
                    <Badge
                      className={
                        metric.status === "ok"
                          ? "bg-green-100 text-green-700"
                          : metric.status === "warning"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }
                    >
                      {metric.status === "ok" ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {metric.status === "ok" ? "OK" : metric.status === "warning" ? "Warning" : "Error"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* DAU vs Registrations */}
        <Card>
          <CardHeader>
            <CardTitle>DAU vs Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyActive.isLoading ? (
              <LoadingState variant="card" />
            ) : dailyActive.isError ? (
              <ErrorState
                title="Failed to load chart"
                description={dailyActive.error?.message}
                onRetry={dailyActive.refetch}
                variant="banner"
              />
            ) : !dailyActive.data || dailyActive.data.length === 0 ? (
              <EmptyState
                title="No data available"
                description="No active users or signups in this date range."
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyActive.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="active" stroke="#8884d8" name="Active Users" />
                  <Line type="monotone" dataKey="new" stroke="#82ca9d" name="New Signups" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Sessions per Day */}
        <Card>
          <CardHeader>
            <CardTitle>Sessions per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {dailySessions.isLoading ? (
              <LoadingState variant="card" />
            ) : dailySessions.isError ? (
              <ErrorState
                title="Failed to load chart"
                description={dailySessions.error?.message}
                onRetry={dailySessions.refetch}
                variant="banner"
              />
            ) : !dailySessions.data || dailySessions.data.length === 0 ? (
              <EmptyState
                title="No sessions found"
                description="No sessions were created in this date range."
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailySessions.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Token Burn Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Token Burn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {tokensByModel.isLoading ? (
              <LoadingState variant="card" />
            ) : tokenBurnRate.length === 0 ? (
              <EmptyState
                title="No token usage data"
                description="No tokens were used in this date range."
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={tokenBurnRate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="tokens" stroke="#f59e0b" name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueOverTime.length === 0 ? (
              <EmptyState
                title="No revenue data"
                description="No revenue data available for this date range."
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Teams by Tokens */}
        <Card>
          <CardHeader>
            <CardTitle>Top Teams by Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            {topTeamsTokens.isLoading ? (
              <LoadingState variant="card" />
            ) : topTeamsTokens.isError ? (
              <ErrorState
                title="Failed to load teams"
                description={topTeamsTokens.error?.message}
                onRetry={topTeamsTokens.refetch}
                variant="banner"
              />
            ) : !topTeamsTokens.data || topTeamsTokens.data.length === 0 ? (
              <EmptyState
                title="No teams found"
                description="No teams used tokens in this date range."
              />
            ) : (
              <div className="space-y-2">
                {topTeamsTokens.data.map((team) => (
                  <Link
                    key={team.team_id}
                    href={`/teams/${team.team_id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50"
                  >
                    <span className="font-medium">{team.team_name}</span>
                    <span className="text-sm text-gray-600">{formatNumber(team.tokens)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Teams by Cost */}
        <Card>
          <CardHeader>
            <CardTitle>Top Teams by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {topTeamsCost.isLoading ? (
              <LoadingState variant="card" />
            ) : topTeamsCost.isError ? (
              <ErrorState
                title="Failed to load teams"
                description={topTeamsCost.error?.message}
                onRetry={topTeamsCost.refetch}
                variant="banner"
              />
            ) : !topTeamsCost.data || topTeamsCost.data.length === 0 ? (
              <EmptyState
                title="No teams found"
                description="No teams incurred costs in this date range."
              />
            ) : (
              <div className="space-y-2">
                {topTeamsCost.data.map((team) => (
                  <Link
                    key={team.team_id}
                    href={`/teams/${team.team_id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50"
                  >
                    <span className="font-medium">{team.team_name}</span>
                    <span className="text-sm text-gray-600">{formatCurrency(team.cost)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Created Teams */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Created Teams</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTeams.isLoading ? (
              <LoadingState variant="card" />
            ) : recentTeams.isError ? (
              <ErrorState
                title="Failed to load teams"
                description={recentTeams.error?.message}
                onRetry={recentTeams.refetch}
                variant="banner"
              />
            ) : !recentTeams.data || recentTeams.data.length === 0 ? (
              <EmptyState
                title="No teams found"
                description="No teams have been created yet."
              />
            ) : (
              <div className="space-y-2">
                {recentTeams.data.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-500">{formatDateTime(team.created_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Failed AI Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Failed AI Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFailures.isLoading ? (
              <LoadingState variant="card" />
            ) : recentFailures.isError ? (
              <ErrorState
                title="Failed to load jobs"
                description={recentFailures.error?.message}
                onRetry={recentFailures.refetch}
                variant="banner"
              />
            ) : !recentFailures.data || recentFailures.data.length === 0 ? (
              <EmptyState
                title="No failed jobs"
                description="Great! No AI jobs have failed recently."
              />
            ) : (
              <div className="space-y-2">
                {recentFailures.data.map((job) => (
                  <div key={job.id} className="rounded-md p-2 hover:bg-gray-50">
                    <div className="font-medium text-red-600">{job.type}</div>
                    <div className="text-sm text-gray-500">{job.error_message || "Unknown error"}</div>
                    {job.finished_at && (
                      <div className="text-xs text-gray-400">{formatDateTime(job.finished_at)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Metrics Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Advanced Metrics</h2>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Mindmap Generation Time */}
          <Card>
            <CardHeader>
              <CardTitle>Mindmap Generation Time</CardTitle>
            </CardHeader>
            <CardContent>
              {generationTime.isLoading ? (
                <LoadingState variant="card" />
              ) : generationTime.isError ? (
                <ErrorState
                  title="Failed to load generation time"
                  description={generationTime.error?.message}
                  variant="banner"
                />
              ) : !generationTime.data ? (
                <EmptyState title="No data" description="No generation time data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Average</span>
                    <span className="font-semibold">{(generationTime.data.avgGenerationTimeMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Median</span>
                    <span className="font-semibold">{(generationTime.data.medianGenerationTimeMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">P95</span>
                    <span className="font-semibold">{(generationTime.data.p95GenerationTimeMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Mindmaps</span>
                    <span className="font-semibold">{formatNumber(generationTime.data.totalMindmaps)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mindmap Edit Count */}
          <Card>
            <CardHeader>
              <CardTitle>Mindmap Edit Count</CardTitle>
            </CardHeader>
            <CardContent>
              {editCount.isLoading ? (
                <LoadingState variant="card" />
              ) : editCount.isError ? (
                <ErrorState
                  title="Failed to load edit count"
                  description={editCount.error?.message}
                  variant="banner"
                />
              ) : !editCount.data ? (
                <EmptyState title="No data" description="No edit count data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Edits</span>
                    <span className="font-semibold">{formatNumber(editCount.data.totalEdits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Mindmaps Edited</span>
                    <span className="font-semibold">{formatNumber(editCount.data.mindmapsWithEdits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Edits/Map</span>
                    <span className="font-semibold">{editCount.data.avgEditsPerMindmap.toFixed(1)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-gray-500 mb-2">By Type:</div>
                    {Object.entries(editCount.data.byEditType).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="capitalize">{type}</span>
                        <span>{formatNumber(count as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Conversion Rate */}
          <Card>
            <CardHeader>
              <CardTitle>File → Map Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {conversionRate.isLoading ? (
                <LoadingState variant="card" />
              ) : conversionRate.isError ? (
                <ErrorState
                  title="Failed to load conversion rate"
                  description={conversionRate.error?.message}
                  variant="banner"
                />
              ) : !conversionRate.data ? (
                <EmptyState title="No data" description="No conversion data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Success Rate</span>
                    <Badge variant={conversionRate.data.successRate >= 95 ? "default" : conversionRate.data.successRate >= 80 ? "secondary" : "destructive"}>
                      {conversionRate.data.successRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Successful</span>
                    <span className="font-semibold text-green-600">{formatNumber(conversionRate.data.successfulConversions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Failed</span>
                    <span className="font-semibold text-red-600">{formatNumber(conversionRate.data.failedConversions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="font-semibold">{formatNumber(conversionRate.data.totalConversions)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Retention */}
          <Card>
            <CardHeader>
              <CardTitle>User Retention by Week</CardTitle>
            </CardHeader>
            <CardContent>
              {userRetention.isLoading ? (
                <LoadingState variant="card" />
              ) : userRetention.isError ? (
                <ErrorState
                  title="Failed to load retention"
                  description={userRetention.error?.message}
                  variant="banner"
                />
              ) : !userRetention.data ? (
                <EmptyState title="No data" description="No retention data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Users</span>
                    <span className="font-semibold">{formatNumber(userRetention.data.totalUsers)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active This Period</span>
                    <span className="font-semibold">{formatNumber(userRetention.data.activeUsersThisPeriod)}</span>
                  </div>
                  {userRetention.data.weeklyRetention.length > 0 && (
                    <div className="pt-2 border-t">
                      <div className="text-xs text-gray-500 mb-2">Recent Weeks:</div>
                      {userRetention.data.weeklyRetention.slice(-4).map((week) => (
                        <div key={week.week} className="flex justify-between text-sm mb-1">
                          <span>{week.week}</span>
                          <span className={week.retentionRate >= 50 ? "text-green-600" : week.retentionRate >= 30 ? "text-yellow-600" : "text-red-600"}>
                            {week.retentionRate.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Funnel Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Steps per Map (Funnel)</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.isLoading ? (
                <LoadingState variant="card" />
              ) : funnel.isError ? (
                <ErrorState
                  title="Failed to load funnel"
                  description={funnel.error?.message}
                  variant="banner"
                />
              ) : !funnel.data ? (
                <EmptyState title="No data" description="No funnel data available." />
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {Object.entries(funnel.data.stepCounts).map(([step, count]) => (
                      <div key={step} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{step}</span>
                        <span className="font-semibold">{formatNumber(count as number)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-gray-500 mb-2">Conversion Rates:</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Upload → Process</span>
                        <span>{funnel.data.conversionRates.uploadToProcess.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Process → Generate</span>
                        <span>{funnel.data.conversionRates.processToGenerate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Generate → View</span>
                        <span>{funnel.data.conversionRates.generateToView.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>View → Edit</span>
                        <span>{funnel.data.conversionRates.viewToEdit.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>View → Export</span>
                        <span>{funnel.data.conversionRates.viewToExport.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Export Rate (PDF/PNG)</CardTitle>
            </CardHeader>
            <CardContent>
              {exportRate.isLoading ? (
                <LoadingState variant="card" />
              ) : exportRate.isError ? (
                <ErrorState
                  title="Failed to load export rate"
                  description={exportRate.error?.message}
                  variant="banner"
                />
              ) : !exportRate.data ? (
                <EmptyState title="No data" description="No export data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Export Rate</span>
                    <Badge variant={exportRate.data.exportRate >= 20 ? "default" : exportRate.data.exportRate >= 10 ? "secondary" : "outline"}>
                      {exportRate.data.exportRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Exports</span>
                    <span className="font-semibold">{formatNumber(exportRate.data.totalExports)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Exported Mindmaps</span>
                    <span className="font-semibold">{formatNumber(exportRate.data.exportedMindmaps)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-gray-500 mb-2">By Type:</div>
                    {Object.entries(exportRate.data.byExportType).map(([type, data]) => (
                      <div key={type} className="flex justify-between text-sm mb-1">
                        <span className="uppercase">{type}</span>
                        <span>{formatNumber(data.total)} ({data.success} success)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collaboration Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Team Collaboration Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {collaboration.isLoading ? (
                <LoadingState variant="card" />
              ) : collaboration.isError ? (
                <ErrorState
                  title="Failed to load collaboration"
                  description={collaboration.error?.message}
                  variant="banner"
                />
              ) : !collaboration.data ? (
                <EmptyState title="No data" description="No collaboration data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Events</span>
                    <span className="font-semibold">{formatNumber(collaboration.data.totalCollaborationEvents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Collaborators</span>
                    <span className="font-semibold">{formatNumber(collaboration.data.activeCollaborators)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Mindmaps</span>
                    <span className="font-semibold">{formatNumber(collaboration.data.activeMindmaps)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-gray-500 mb-2">By Activity:</div>
                    {Object.entries(collaboration.data.byActivityType).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                        <span>{formatNumber(count as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Burn by Feature */}
          <Card>
            <CardHeader>
              <CardTitle>Token Burn per Feature</CardTitle>
            </CardHeader>
            <CardContent>
              {tokenBurnByFeature.isLoading ? (
                <LoadingState variant="card" />
              ) : tokenBurnByFeature.isError ? (
                <ErrorState
                  title="Failed to load token burn"
                  description={tokenBurnByFeature.error?.message}
                  variant="banner"
                />
              ) : !tokenBurnByFeature.data ? (
                <EmptyState title="No data" description="No token burn data available." />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Tokens</span>
                    <span className="font-semibold">{formatNumber(tokenBurnByFeature.data.totalTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Events</span>
                    <span className="font-semibold">{formatNumber(tokenBurnByFeature.data.totalEvents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg per Event</span>
                    <span className="font-semibold">{formatNumber(tokenBurnByFeature.data.avgTokensPerEvent)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-gray-500 mb-2">By Feature:</div>
                    {Object.entries(tokenBurnByFeature.data.byFeature)
                      .sort(([, a], [, b]) => (b as any).total - (a as any).total)
                      .slice(0, 5)
                      .map(([feature, data]) => (
                        <div key={feature} className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                          <span>{formatNumber((data as any).total)} ({((data as any).avg).toFixed(0)} avg)</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Map Economics Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Map Economics</h2>
        
        {mapEconomics.isLoading ? (
          <LoadingState variant="card" />
        ) : mapEconomics.isError ? (
          <ErrorState
            title="Failed to load economics"
            description={mapEconomics.error?.message}
            variant="banner"
          />
        ) : !mapEconomics.data || mapEconomics.data.teams.length === 0 ? (
          <EmptyState title="No economics data" description="No team economics data available for this period." />
        ) : (
          <div className="space-y-6">
            {/* Totals Summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Total MRR</div>
                  <div className="text-2xl font-bold">{formatCurrency(mapEconomics.data.totals.mrr)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Total Token Cost</div>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(mapEconomics.data.totals.tokenCost)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Total AI Margin</div>
                  <div className={`text-2xl font-bold ${mapEconomics.data.totals.aiMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(mapEconomics.data.totals.aiMargin)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Total Mindmaps</div>
                  <div className="text-2xl font-bold">{formatNumber(mapEconomics.data.totals.mindmaps)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Teams Table */}
            <Card>
              <CardHeader>
                <CardTitle>Team Economics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Team</th>
                        <th className="text-right p-2">Plan</th>
                        <th className="text-right p-2">MRR</th>
                        <th className="text-right p-2">Token Cost</th>
                        <th className="text-right p-2">AI Margin</th>
                        <th className="text-right p-2">Mindmaps</th>
                        <th className="text-right p-2">Active Users</th>
                        <th className="text-right p-2">Cost/Map</th>
                        <th className="text-right p-2">Maps/User</th>
                        <th className="text-center p-2">Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapEconomics.data.teams
                        .sort((a, b) => b.aiMargin - a.aiMargin)
                        .map((team) => {
                          const isHealthy = team.aiMargin > 0 && team.mindmapsCount >= 5
                          const isWarning = team.aiMargin > 0 && team.mindmapsCount < 5
                          const isCritical = team.aiMargin <= 0
                          
                          return (
                            <tr key={team.teamId} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{team.teamName}</td>
                              <td className="p-2 text-right">
                                <Badge variant={team.plan === 'enterprise' ? 'default' : team.plan === 'team' ? 'secondary' : 'outline'}>
                                  {team.plan}
                                </Badge>
                              </td>
                              <td className="p-2 text-right">{formatCurrency(team.mrr)}</td>
                              <td className="p-2 text-right text-red-600">{formatCurrency(team.totalTokenCost)}</td>
                              <td className={`p-2 text-right font-semibold ${team.aiMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(team.aiMargin)}
                              </td>
                              <td className="p-2 text-right">{formatNumber(team.mindmapsCount)}</td>
                              <td className="p-2 text-right">{formatNumber(team.activeUsers)}</td>
                              <td className="p-2 text-right">{formatCurrency(team.costPerMindmap)}</td>
                              <td className="p-2 text-right">{team.mapsPerActiveUser.toFixed(1)}</td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant={isHealthy ? 'default' : isWarning ? 'secondary' : 'destructive'}
                                  className={isHealthy ? 'bg-green-100 text-green-800' : isWarning ? 'bg-yellow-100 text-yellow-800' : ''}
                                >
                                  {isHealthy ? 'Green' : isWarning ? 'Yellow' : 'Red'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Behavior Cohorts Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Behavior Cohorts</h2>
        
        {behaviorCohorts.isLoading ? (
          <LoadingState variant="card" />
        ) : behaviorCohorts.isError ? (
          <ErrorState
            title="Failed to load cohorts"
            description={behaviorCohorts.error?.message}
            variant="banner"
          />
        ) : !behaviorCohorts.data || behaviorCohorts.data.cohorts.length === 0 ? (
          <EmptyState title="No cohort data" description="No behavior cohort data available for this signup window." />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Retention Curves by Week-1 Behavior</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {behaviorCohorts.data.cohorts.map((cohort) => {
                    const week8Retention = cohort.weeks.find(w => w.weekNumber === 8)?.retentionRate || 0
                    const week4Retention = cohort.weeks.find(w => w.weekNumber === 4)?.retentionRate || 0
                    
                    return (
                      <div key={cohort.cohortKey} className="p-4 border rounded-lg">
                        <div className="font-semibold text-sm mb-2">
                          {cohort.cohortKey.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-600 mb-1">Cohort Size: {formatNumber(cohort.size)}</div>
                        <div className="text-xs text-gray-600">Week 8 Retention: {(week8Retention * 100).toFixed(1)}%</div>
                      </div>
                    )
                  })}
                </div>

                {/* Chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      // Transform cohort data for chart
                      const maxWeeks = Math.max(...behaviorCohorts.data.cohorts.map(c => c.weeks.length))
                      const chartData = []
                      
                      for (let week = 1; week <= maxWeeks; week++) {
                        const point: any = { week }
                        behaviorCohorts.data.cohorts.forEach(cohort => {
                          const weekData = cohort.weeks.find(w => w.weekNumber === week)
                          if (weekData) {
                            point[cohort.cohortKey] = weekData.retentionRate * 100
                          }
                        })
                        chartData.push(point)
                      }
                      
                      return chartData
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'Retention %', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend />
                      {behaviorCohorts.data.cohorts.map((cohort) => (
                        <Line
                          key={cohort.cohortKey}
                          type="monotone"
                          dataKey={cohort.cohortKey}
                          stroke={
                            cohort.cohortKey === 'EXPORTERS_WEEK1' ? '#10b981' :
                            cohort.cohortKey === 'EDITORS_3PLUS_WEEK1' ? '#3b82f6' :
                            cohort.cohortKey === 'ONE_AND_DONE' ? '#ef4444' :
                            '#f59e0b'
                          }
                          strokeWidth={2}
                          name={cohort.cohortKey.replace(/_/g, ' ')}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Insights */}
                <div className="pt-4 border-t">
                  <div className="text-sm font-semibold mb-2">Key Insights</div>
                  <div className="text-sm text-gray-600 space-y-1">
                    {(() => {
                      const exporters = behaviorCohorts.data.cohorts.find(c => c.cohortKey === 'EXPORTERS_WEEK1')
                      const oneAndDone = behaviorCohorts.data.cohorts.find(c => c.cohortKey === 'ONE_AND_DONE')
                      
                      const insights = []
                      if (exporters) {
                        const week8 = exporters.weeks.find(w => w.weekNumber === 8)?.retentionRate || 0
                        insights.push(`Exporters in week 1 retain ${(week8 * 100).toFixed(1)}% at week 8`)
                      }
                      if (oneAndDone) {
                        const week4 = oneAndDone.weeks.find(w => w.weekNumber === 4)?.retentionRate || 0
                        insights.push(`One-and-done users retain ${(week4 * 100).toFixed(1)}% at week 4`)
                      }
                      return insights.length > 0 ? insights : ['No insights available']
                    })().map((insight, i) => (
                      <div key={i}>• {insight}</div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
