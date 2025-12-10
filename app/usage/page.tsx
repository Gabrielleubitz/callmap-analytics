"use client"

import { useState, useEffect } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatNumber } from "@/lib/utils"
import {
  getUsageMetrics,
  getDailyTokens,
  getDailyTokensByModel,
  getTokensBySourceType,
  getSessions,
  getMostExpensiveSessions,
  getTeamsOverQuota,
  DateRange,
} from "@/lib/db"
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

export default function UsagePage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })
  const [metrics, setMetrics] = useState<any>(null)
  const [dailyTokens, setDailyTokens] = useState<any[]>([])
  const [tokensByModel, setTokensByModel] = useState<any[]>([])
  const [tokensByModelChart, setTokensByModelChart] = useState<any[]>([])
  const [tokensBySource, setTokensBySource] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [expensiveSessions, setExpensiveSessions] = useState<any[]>([])
  const [teamsOverQuota, setTeamsOverQuota] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [m, dt, tbm, tbs, s, es, toq] = await Promise.all([
        getUsageMetrics(dateRange),
        getDailyTokens(dateRange),
        getDailyTokensByModel(dateRange),
        getTokensBySourceType(dateRange),
        getSessions({ page: 1, pageSize: 50 }),
        getMostExpensiveSessions(dateRange, 10),
        getTeamsOverQuota(),
      ])
      setMetrics(m)
      setDailyTokens(dt)
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
      setTokensBySource(tbs)
      setSessions(s.data)
      setExpensiveSessions(es)
      setTeamsOverQuota(toq)
    }
    load()
  }, [dateRange])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Usage & Tokens</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tokens In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.totalTokensIn || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tokens Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.totalTokensOut || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Tokens/Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics?.avgTokensPerSession || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.totalCost || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Models Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.tokensByModel?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Tokens Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyTokens}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="tokens" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
            <CardTitle>Tokens by Source Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tokensBySource}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="source_type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tokens" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most Expensive Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expensiveSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-4">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  expensiveSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-xs">{session.id.slice(0, 8)}</TableCell>
                      <TableCell>{session.source_type}</TableCell>
                      <TableCell>
                        {formatNumber((session.tokens_in || 0) + (session.tokens_out || 0))}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(session.cost_usd || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teams Over Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Quota</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamsOverQuota.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-4">
                      No teams over quota
                    </TableCell>
                  </TableRow>
                ) : (
                  teamsOverQuota.map((team) => (
                    <TableRow key={team.team_id}>
                      <TableCell className="font-medium">{team.team_name}</TableCell>
                      <TableCell>{formatNumber(team.used)}</TableCell>
                      <TableCell>{formatNumber(team.quota)}</TableCell>
                      <TableCell>
                        <Badge variant={team.percentage > 100 ? "destructive" : "default"}>
                          {team.percentage.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

