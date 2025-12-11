"use client"

/**
 * Usage Page - Redesigned
 * 
 * New layout structure:
 * 1. Hero row (3 large cards: Total Tokens, Total Cost, Avg Tokens/Session)
 * 2. Token Usage section (grouped metrics)
 * 3. Session Metrics section (grouped metrics)
 * 4. Cost Analysis section (grouped metrics)
 * 5. Charts (3-4 charts below metrics)
 * 6. Tables (detailed data at bottom)
 */

import { useState, useMemo } from "react"
import { startOfDay, endOfDay, subDays, format } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatNumber } from "@/lib/utils"
import {
  getUsageMetrics,
  getDailyTokens,
  getDailyTokensByModel,
  getTokensBySourceType,
  getMostExpensiveSessions,
  getTeamsOverQuota,
  getWalletMetrics,
  DateRange,
} from "@/lib/db"
import { useApiData } from "@/lib/hooks/useApiData"
import { HeroMetricCard } from "@/components/metrics/hero-metric-card"
import { MetricGroupCard } from "@/components/metrics/metric-group-card"
import {
  AreaChart,
  Area,
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
import { Zap, DollarSign, TrendingUp, Database, Activity, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react"

export default function UsagePage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  // Fetch all data using useApiData hook
  const metrics = useApiData(() => getUsageMetrics(dateRange), [dateRange])
  const dailyTokens = useApiData(() => getDailyTokens(dateRange), [dateRange])
  const tokensByModel = useApiData(() => getDailyTokensByModel(dateRange), [dateRange])
  const tokensBySource = useApiData(() => getTokensBySourceType(dateRange), [dateRange])
  const expensiveSessions = useApiData(() => getMostExpensiveSessions(dateRange, 10), [dateRange])
  const teamsOverQuota = useApiData(() => getTeamsOverQuota(), [])
  const walletMetrics = useApiData(() => getWalletMetrics(dateRange, 1000), [dateRange])

  // Transform tokens by model for chart display
  const tokensByModelChart = useMemo(() => {
    if (!tokensByModel.data) return []
    
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

  // Calculate total tokens (in + out)
  const totalTokens = useMemo(() => {
    if (!metrics.data) return 0
    return (metrics.data.totalTokensIn || 0) + (metrics.data.totalTokensOut || 0)
  }, [metrics.data])

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Usage & Tokens</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Hero Metrics Row */}
      {metrics.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <LoadingState key={i} variant="card" />
          ))}
        </div>
      ) : metrics.isError ? (
        <ErrorState
          title="Failed to load usage metrics"
          description={metrics.error?.message || "Unable to fetch usage data. Please try again."}
          onRetry={metrics.refetch}
        />
      ) : metrics.data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          <HeroMetricCard
            title="Total Tokens"
            value={formatNumber(totalTokens)}
            icon={<Zap className="h-5 w-5" />}
            description={`${formatNumber(metrics.data.totalTokensIn || 0)} in • ${formatNumber(metrics.data.totalTokensOut || 0)} out`}
          />
          <HeroMetricCard
            title="Total Cost"
            value={formatCurrency(metrics.data.totalCost || 0)}
            icon={<DollarSign className="h-5 w-5" />}
            description="Estimated token cost"
          />
          <HeroMetricCard
            title="Avg Tokens/Session"
            value={formatNumber(metrics.data.avgTokensPerSession || 0)}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Average per session"
          />
        </div>
      ) : null}

      {/* Grouped Metric Sections */}
      {metrics.data && (
        <div className="space-y-6 mb-8">
          {/* Token Usage Section */}
          <MetricGroupCard
            title="Token Usage"
            icon={<Database className="h-4 w-4" />}
            metrics={[
              {
                label: "Tokens In",
                value: formatNumber(metrics.data.totalTokensIn || 0),
              },
              {
                label: "Tokens Out",
                value: formatNumber(metrics.data.totalTokensOut || 0),
              },
              {
                label: "Models Used",
                value: (metrics.data.tokensByModel?.length || 0).toString(),
              },
            ]}
          />

          {/* Session Metrics Section */}
          <MetricGroupCard
            title="Session Metrics"
            icon={<Activity className="h-4 w-4" />}
            metrics={[
              {
                label: "Avg Tokens/Session",
                value: formatNumber(metrics.data.avgTokensPerSession || 0),
              },
              {
                label: "Total Sessions",
                value: "N/A", // Would need to fetch separately
              },
              {
                label: "Expensive Sessions",
                value: expensiveSessions.data?.length?.toString() || "0",
              },
            ]}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Total Tokens Per Day */}
        {dailyTokens.isLoading ? (
          <LoadingState variant="card" />
        ) : dailyTokens.isError ? (
          <ErrorState
            title="Failed to load chart data"
            description={dailyTokens.error?.message}
          />
        ) : dailyTokens.data && dailyTokens.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Total Tokens Per Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyTokens.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="tokens" stroke="#8884d8" fill="#8884d8" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No token data" description="No daily token data available for this date range." />
        )}

        {/* Tokens by Model Per Day */}
        {tokensByModel.isLoading ? (
          <LoadingState variant="card" />
        ) : tokensByModel.isError ? (
          <ErrorState
            title="Failed to load chart data"
            description={tokensByModel.error?.message}
          />
        ) : tokensByModelChart.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tokens by Model Per Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tokensByModelChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {tokensByModel.data && Array.from(new Set(tokensByModel.data.map((item: any) => item.model))).map((model, idx) => {
                    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00']
                    return (
                      <Bar key={model} dataKey={model} stackId="a" fill={colors[idx % colors.length]} />
                    )
                  })}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No model data" description="No token data by model available for this date range." />
        )}

        {/* Tokens by Source Type */}
        {tokensBySource.isLoading ? (
          <LoadingState variant="card" />
        ) : tokensBySource.isError ? (
          <ErrorState
            title="Failed to load chart data"
            description={tokensBySource.error?.message}
          />
        ) : tokensBySource.data && tokensBySource.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tokens by Source Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tokensBySource.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source_type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tokens" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No source data" description="No token data by source type available for this date range." />
        )}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Most Expensive Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Most Expensive Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {expensiveSessions.isLoading ? (
              <LoadingState variant="table" />
            ) : expensiveSessions.isError ? (
              <ErrorState
                title="Failed to load sessions"
                description={expensiveSessions.error?.message}
              />
            ) : !expensiveSessions.data || expensiveSessions.data.length === 0 ? (
              <EmptyState
                title="No expensive sessions"
                description="No expensive sessions found in this date range."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">ID</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Source</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Tokens</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensiveSessions.data.map((session: any) => (
                      <tr key={session.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-xs">{session.id.slice(0, 8)}</td>
                        <td className="py-2 px-2">{session.source_type}</td>
                        <td className="py-2 px-2 text-right">
                          {formatNumber((session.tokens_in || 0) + (session.tokens_out || 0))}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {formatCurrency(session.cost_usd || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teams Over Quota */}
        <Card>
          <CardHeader>
            <CardTitle>Teams Over Quota</CardTitle>
          </CardHeader>
          <CardContent>
            {teamsOverQuota.isLoading ? (
              <LoadingState variant="table" />
            ) : teamsOverQuota.isError ? (
              <ErrorState
                title="Failed to load teams"
                description={teamsOverQuota.error?.message}
              />
            ) : !teamsOverQuota.data || teamsOverQuota.data.length === 0 ? (
              <EmptyState
                title="No teams over quota"
                description="All teams are within their token quotas."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Team</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Used</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Quota</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamsOverQuota.data.map((team: any) => (
                      <tr key={team.team_id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <Link
                            href={`/teams/${team.team_id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {team.team_name}
                          </Link>
                        </td>
                        <td className="py-2 px-2 text-right">{formatNumber(team.used)}</td>
                        <td className="py-2 px-2 text-right">{formatNumber(team.quota)}</td>
                        <td className="py-2 px-2 text-right">
                          <Badge variant={team.percentage > 100 ? "destructive" : "default"}>
                            {team.percentage.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Metrics */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Movement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {walletMetrics.isLoading ? (
              <LoadingState variant="card" />
            ) : walletMetrics.isError ? (
              <ErrorState
                title="Failed to load wallet metrics"
                description={walletMetrics.error?.message}
                onRetry={walletMetrics.refetch}
              />
            ) : !walletMetrics.data ? (
              <EmptyState
                title="No wallet data"
                description="No wallet transactions found in this date range."
              />
            ) : (
              <div className="space-y-6">
                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <HeroMetricCard
                    title="Total Credits"
                    value={formatNumber(walletMetrics.data.totals.credits)}
                    icon={<ArrowUpCircle className="h-4 w-4 text-green-600" />}
                  />
                  <HeroMetricCard
                    title="Total Debits"
                    value={formatNumber(walletMetrics.data.totals.debits)}
                    icon={<ArrowDownCircle className="h-4 w-4 text-red-600" />}
                  />
                  <HeroMetricCard
                    title="Net Movement"
                    value={formatNumber(walletMetrics.data.totals.net)}
                    icon={<Activity className="h-4 w-4" />}
                  />
                  <HeroMetricCard
                    title="Active Wallets"
                    value={formatNumber(walletMetrics.data.activeWallets)}
                    icon={<Wallet className="h-4 w-4" />}
                  />
                </div>

                {/* Low Balance Alert */}
                {walletMetrics.data.lowBalanceCount > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-900">
                          {walletMetrics.data.lowBalanceCount} users with balance below {formatNumber(walletMetrics.data.threshold)} tokens
                        </p>
                        <p className="text-sm text-yellow-700">
                          Consider reaching out to these users about top-up options.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Daily Breakdown Chart */}
                {walletMetrics.data.dailyBreakdown.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-4">Daily Credits vs Debits</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={walletMetrics.data.dailyBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return format(date, "MMM d, yyyy")
                          }}
                          formatter={(value: number) => formatNumber(value)}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="credits"
                          stackId="1"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.6}
                          name="Credits"
                        />
                        <Area
                          type="monotone"
                          dataKey="debits"
                          stackId="1"
                          stroke="#ef4444"
                          fill="#ef4444"
                          fillOpacity={0.6}
                          name="Debits"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-gray-600">Unique Users</p>
                    <p className="text-2xl font-semibold">{formatNumber(walletMetrics.data.uniqueUsers)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Low Balance Users</p>
                    <p className="text-2xl font-semibold text-yellow-600">
                      {formatNumber(walletMetrics.data.lowBalanceCount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Threshold</p>
                    <p className="text-2xl font-semibold">{formatNumber(walletMetrics.data.threshold)} tokens</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
