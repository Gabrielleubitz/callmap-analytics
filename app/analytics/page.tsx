"use client"

/**
 * Consolidated Analytics Hub
 * 
 * Combines Usage, Billing, and Revenue Optimization into a single unified interface
 */

import { useState, useEffect } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"
import {
  getUsageMetrics,
  getDailyTokens,
  getDailyTokensByModel,
  getTokensBySourceType,
  getMostExpensiveSessions,
  getTeamsOverQuota,
  getBillingMetrics,
  getRevenueOverTime,
  getRevenueByPlan,
  getChurnByMonth,
  DateRange,
} from "@/lib/db"
import { useApiData } from "@/lib/hooks/useApiData"
import { HeroMetricCard } from "@/components/metrics/hero-metric-card"
import { MetricGroupCard } from "@/components/metrics/metric-group-card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"
import { Zap, DollarSign, TrendingUp, AlertCircle, Users, Target, ArrowUpRight } from "lucide-react"
import { AICoach } from "@/components/ai/ai-coach"

interface RevenueOpportunity {
  userId: string
  type: 'upsell' | 'win_back' | 'expansion'
  currentPlan: string
  recommendedPlan: string
  opportunityValue: number
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

export default function AnalyticsHubPage() {
  const [activeTab, setActiveTab] = useState("usage")
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  // Usage data
  const usageMetrics = useApiData(() => getUsageMetrics(dateRange), [dateRange])
  const dailyTokens = useApiData(() => getDailyTokens(dateRange), [dateRange])
  const tokensByModel = useApiData(() => getDailyTokensByModel(dateRange), [dateRange])
  const expensiveSessions = useApiData(() => getMostExpensiveSessions(dateRange, 10), [dateRange])
  const teamsOverQuota = useApiData(() => getTeamsOverQuota(), [])

  // Billing data
  const billingMetrics = useApiData(() => getBillingMetrics(dateRange), [dateRange])
  const revenueOverTime = useApiData(() => getRevenueOverTime(dateRange), [dateRange])
  const revenueByPlan = useApiData(() => getRevenueByPlan(dateRange), [dateRange])
  const churn = useApiData(() => getChurnByMonth(dateRange), [dateRange])

  // Revenue opportunities
  const [opportunities, setOpportunities] = useState<RevenueOpportunity[]>([])
  const [oppLoading, setOppLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'upsell' | 'win_back' | 'expansion'>('all')

  // Fetch opportunities when tab is active
  useEffect(() => {
    if (activeTab === "revenue") {
      setOppLoading(true)
      fetch('/api/analytics/revenue-opportunities')
        .then(res => res.json())
        .then(data => {
          setOpportunities(data.items || [])
          setOppLoading(false)
        })
        .catch(() => setOppLoading(false))
    }
  }, [activeTab])

  const totalTokens = usageMetrics.data
    ? (usageMetrics.data.totalTokensIn || 0) + (usageMetrics.data.totalTokensOut || 0)
    : 0

  const filteredOpportunities = filter === 'all'
    ? opportunities
    : opportunities.filter(o => o.type === filter)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <AICoach
          pageContext={{
            pageName: "Analytics Hub",
            description: "Comprehensive analytics for usage, billing, and revenue optimization",
          }}
        />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl font-bold gradient-text">Analytics Hub</h1>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <p className="text-slate-600 text-sm">
          Comprehensive analytics for usage, billing, and revenue optimization
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Usage & Tokens
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Billing & Revenue
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Revenue Optimization
          </TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          {usageMetrics.isLoading ? (
            <LoadingState />
          ) : usageMetrics.isError ? (
            <ErrorState description={usageMetrics.error?.message} onRetry={usageMetrics.refetch} />
          ) : usageMetrics.data ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HeroMetricCard
                  title="Total Tokens"
                  value={formatNumber(totalTokens)}
                  icon={<Zap className="h-5 w-5" />}
                />
                <HeroMetricCard
                  title="Total Cost"
                  value={formatCurrency(usageMetrics.data.totalCost || 0)}
                  icon={<DollarSign className="h-5 w-5" />}
                />
                <HeroMetricCard
                  title="Avg Tokens/Session"
                  value={formatNumber(usageMetrics.data.avgTokensPerSession || 0)}
                  icon={<TrendingUp className="h-5 w-5" />}
                />
              </div>

              <MetricGroupCard
                title="Token Usage Breakdown"
                metrics={[
                  { label: "Tokens In", value: formatNumber(usageMetrics.data.totalTokensIn || 0) },
                  { label: "Tokens Out", value: formatNumber(usageMetrics.data.totalTokensOut || 0) },
                  { label: "Expensive Sessions", value: (expensiveSessions.data?.length || 0).toString() },
                ]}
              />

              {dailyTokens.data && dailyTokens.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Token Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={dailyTokens.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="tokens" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {teamsOverQuota.data && teamsOverQuota.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Teams Over Quota</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {teamsOverQuota.data.slice(0, 10).map((team: any) => (
                        <div key={team.teamId} className="flex items-center justify-between p-3 rounded-lg border border-white/20">
                          <Link href={`/teams/${team.teamId}`} className="text-cyan-600 hover:underline">
                            {team.teamId.slice(0, 12)}...
                          </Link>
                          <Badge className="bg-orange-100 text-orange-700">
                            {((team.usage / team.quota) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          {billingMetrics.isLoading ? (
            <LoadingState />
          ) : billingMetrics.isError ? (
            <ErrorState description={billingMetrics.error?.message} onRetry={billingMetrics.refetch} />
          ) : billingMetrics.data ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HeroMetricCard
                  title="MRR"
                  value={formatCurrency(billingMetrics.data.mrr || 0)}
                  icon={<DollarSign className="h-5 w-5" />}
                />
                <HeroMetricCard
                  title="Total Revenue"
                  value={formatCurrency(billingMetrics.data.totalRevenue || 0)}
                  icon={<TrendingUp className="h-5 w-5" />}
                />
                <HeroMetricCard
                  title="Unpaid Invoices"
                  value={formatCurrency(billingMetrics.data.unpaidInvoices || 0)}
                  icon={<AlertCircle className="h-5 w-5" />}
                />
              </div>

              {revenueOverTime.data && revenueOverTime.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueOverTime.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {revenueByPlan.data && revenueByPlan.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueByPlan.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="plan" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Revenue Optimization Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="flex gap-2 mb-4">
            {(['all', 'upsell', 'win_back', 'expansion'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  filter === f
                    ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-white/60 backdrop-blur-sm text-slate-700 hover:bg-white/80'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>

          {oppLoading ? (
            <LoadingState />
          ) : filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Target className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p>No revenue opportunities found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-3xl font-bold">{filteredOpportunities.length}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-3xl font-bold">
                      {formatCurrency(filteredOpportunities.reduce((sum, o) => sum + o.opportunityValue, 0))}
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600">High Confidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-3xl font-bold">
                      {filteredOpportunities.filter(o => o.confidence === 'high').length}
                    </span>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Opportunities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredOpportunities.slice(0, 20).map((opp) => (
                      <div
                        key={opp.userId}
                        className="p-4 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Badge className={
                              opp.type === 'upsell' ? 'bg-blue-100 text-blue-700' :
                              opp.type === 'win_back' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }>
                              {opp.type.replace('_', ' ')}
                            </Badge>
                            <Badge className={
                              opp.confidence === 'high' ? 'bg-green-100 text-green-700' :
                              opp.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }>
                              {opp.confidence}
                            </Badge>
                          </div>
                          <span className="text-lg font-bold text-cyan-600">
                            {formatCurrency(opp.opportunityValue)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">{opp.reason}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span>{opp.currentPlan} → {opp.recommendedPlan}</span>
                          <Link href={`/users/${opp.userId}`} className="text-cyan-600 hover:underline">
                            View User
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

