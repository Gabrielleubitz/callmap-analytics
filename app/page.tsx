"use client"

import { useState, useEffect } from "react"
import { startOfDay, endOfDay, subDays, format } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { DateRange, getOverviewMetrics, getDailyActiveUsers, getDailySessions, getDailyTokensByModel, getTokensByPlan, getTopTeamsByTokens, getTopTeamsByCost, getRecentlyCreatedTeams, getRecentlyFailedAIJobs } from "@/lib/db"
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
  ComposedChart,
  Area,
  AreaChart,
} from "recharts"
import Link from "next/link"
import { formatDateTime } from "@/lib/utils"

export default function OverviewPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })
  const [metrics, setMetrics] = useState<any>(null)
  const [dailyActive, setDailyActive] = useState<any[]>([])
  const [dailySessions, setDailySessions] = useState<any[]>([])
  const [tokensByModel, setTokensByModel] = useState<any[]>([])
  const [tokensByModelChart, setTokensByModelChart] = useState<any[]>([])
  const [tokensByPlan, setTokensByPlan] = useState<any[]>([])
  const [topTeamsTokens, setTopTeamsTokens] = useState<any[]>([])
  const [topTeamsCost, setTopTeamsCost] = useState<any[]>([])
  const [recentTeams, setRecentTeams] = useState<any[]>([])
  const [recentFailures, setRecentFailures] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [m, da, ds, tbm, tbp, ttt, ttc, rt, rf] = await Promise.all([
        getOverviewMetrics(dateRange),
        getDailyActiveUsers(dateRange),
        getDailySessions(dateRange),
        getDailyTokensByModel(dateRange),
        getTokensByPlan(dateRange),
        getTopTeamsByTokens(dateRange, 10),
        getTopTeamsByCost(dateRange, 10),
        getRecentlyCreatedTeams(10),
        getRecentlyFailedAIJobs(10),
      ])
      setMetrics(m)
      setDailyActive(da)
      setDailySessions(ds)
      setTokensByModel(tbm)
      
      // Transform tokens by model for chart display
      const modelMap = new Map<string, Map<string, number>>()
      tbm.forEach((item: any) => {
        if (!modelMap.has(item.date)) {
          modelMap.set(item.date, new Map())
        }
        modelMap.get(item.date)!.set(item.model, item.tokens)
      })
      
      const allModels = new Set<string>()
      tbm.forEach((item: any) => allModels.add(item.model))
      
      const chartData = Array.from(modelMap.entries()).map(([date, models]) => {
        const entry: any = { date }
        allModels.forEach((model) => {
          entry[model] = models.get(model) || 0
        })
        return entry
      }).sort((a, b) => a.date.localeCompare(b.date))
      
      setTokensByModelChart(chartData)
      setTokensByPlan(tbp)
      setTopTeamsTokens(ttt)
      setTopTeamsCost(ttc)
      setRecentTeams(rt)
      setRecentFailures(rf)
    }
    load()
  }, [dateRange])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.total_users || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.active_users || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">New Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.new_registrations || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.active_teams || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.sessions || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.tokens_used || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.estimated_cost || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">MRR Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.mrr_estimate || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Active Users vs New Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyActive}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="active" stroke="#8884d8" name="Active Users" />
                <Line type="monotone" dataKey="new" stroke="#82ca9d" name="New Signups" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySessions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tokens Used Per Day by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tokensByModelChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {Array.from(new Set(tokensByModel.map((item: any) => item.model))).map((model, idx) => {
                  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00']
                  return (
                    <Bar key={model} dataKey={model} stackId="a" fill={colors[idx % colors.length]} />
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tokens Used by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tokensByPlan}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plan" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tokens" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Teams by Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topTeamsTokens.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No data available</div>
              ) : (
                topTeamsTokens.map((team) => (
                  <Link
                    key={team.team_id}
                    href={`/teams/${team.team_id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50"
                  >
                    <span className="font-medium">{team.team_name}</span>
                    <span className="text-sm text-gray-600">{formatNumber(team.tokens)}</span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Teams by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topTeamsCost.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No data available</div>
              ) : (
                topTeamsCost.map((team) => (
                  <Link
                    key={team.team_id}
                    href={`/teams/${team.team_id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50"
                  >
                    <span className="font-medium">{team.team_name}</span>
                    <span className="text-sm text-gray-600">{formatCurrency(team.cost)}</span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Created Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTeams.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No data available</div>
              ) : (
                recentTeams.map((team) => (
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
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Failed AI Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentFailures.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No failed jobs</div>
              ) : (
                recentFailures.map((job) => (
                  <div key={job.id} className="rounded-md p-2 hover:bg-gray-50">
                    <div className="font-medium text-red-600">{job.type}</div>
                    <div className="text-sm text-gray-500">{job.error_message || "Unknown error"}</div>
                    {job.finished_at && (
                      <div className="text-xs text-gray-400">{formatDateTime(job.finished_at)}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

