"use client"

/**
 * Billing Page - Redesigned
 * 
 * New layout structure:
 * 1. Hero row (3 large cards: MRR, Total Revenue, Unpaid Invoices)
 * 2. Revenue section (grouped metrics)
 * 3. Subscriptions section (grouped metrics)
 * 4. Charts (Revenue Over Time, Revenue by Plan, Churn)
 * 5. Tables (Subscriptions, Invoices, Payments, Credits)
 */

import { useState } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { DateRangePicker } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  getBillingMetrics,
  getRevenueOverTime,
  getRevenueByPlan,
  getChurnByMonth,
  getSubscriptions,
  getInvoices,
  getPayments,
  getCredits,
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"
import { DollarSign, TrendingUp, AlertCircle, Users } from "lucide-react"

export default function BillingPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 90)),
    end: endOfDay(new Date()),
  })

  // Fetch all data using useApiData hook
  const metrics = useApiData(() => getBillingMetrics(dateRange), [dateRange])
  const revenueOverTime = useApiData(() => getRevenueOverTime(dateRange), [dateRange])
  const revenueByPlan = useApiData(() => getRevenueByPlan(dateRange), [dateRange])
  const churn = useApiData(() => getChurnByMonth(dateRange), [dateRange])
  const subscriptions = useApiData(() => getSubscriptions({ page: 1, pageSize: 50 }), [])
  const invoices = useApiData(() => getInvoices({ page: 1, pageSize: 50 }), [])
  const payments = useApiData(() => getPayments({ page: 1, pageSize: 50 }), [])
  const credits = useApiData(() => getCredits({ page: 1, pageSize: 50 }), [])

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
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
          title="Failed to load billing metrics"
          description={metrics.error?.message || "Unable to fetch billing data. Please try again."}
          onRetry={metrics.refetch}
        />
      ) : metrics.data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          <HeroMetricCard
            title="MRR"
            value={formatCurrency(metrics.data.mrr || 0)}
            icon={<DollarSign className="h-5 w-5" />}
            description="Monthly Recurring Revenue"
          />
          <HeroMetricCard
            title="Total Revenue"
            value={formatCurrency(metrics.data.totalRevenue || 0)}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Total revenue in date range"
          />
          <HeroMetricCard
            title="Unpaid Invoices"
            value={formatCurrency(metrics.data.unpaidInvoices || 0)}
            icon={<AlertCircle className="h-5 w-5" />}
            description="Outstanding amount"
          />
        </div>
      ) : null}

      {/* Grouped Metric Sections */}
      {metrics.data && (
        <div className="space-y-6 mb-8">
          {/* Revenue Section */}
          <MetricGroupCard
            title="Revenue"
            icon={<DollarSign className="h-4 w-4" />}
            metrics={[
              {
                label: "MRR",
                value: formatCurrency(metrics.data.mrr || 0),
              },
              {
                label: "Total Revenue",
                value: formatCurrency(metrics.data.totalRevenue || 0),
              },
              {
                label: "Unpaid Invoices",
                value: formatCurrency(metrics.data.unpaidInvoices || 0),
              },
            ]}
          />

          {/* Subscriptions Section */}
          <MetricGroupCard
            title="Subscriptions"
            icon={<Users className="h-4 w-4" />}
            metrics={[
              {
                label: "Paying Teams",
                value: (metrics.data.payingTeams || 0).toString(),
              },
              {
                label: "Active Subscriptions",
                value: subscriptions.data?.filter((s: any) => s.status === "active").length?.toString() || "0",
              },
              {
                label: "Canceled This Month",
                value: churn.data?.find((c: any) => {
                  const now = new Date()
                  return c.month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                })?.canceled?.toString() || "0",
              },
            ]}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Revenue Over Time */}
        {revenueOverTime.isLoading ? (
          <LoadingState variant="card" />
        ) : revenueOverTime.isError ? (
          <ErrorState
            title="Failed to load chart data"
            description={revenueOverTime.error?.message}
          />
        ) : revenueOverTime.data && revenueOverTime.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueOverTime.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No revenue data" description="No revenue data available for this date range." />
        )}

        {/* Revenue by Plan */}
        {revenueByPlan.isLoading ? (
          <LoadingState variant="card" />
        ) : revenueByPlan.isError ? (
          <ErrorState
            title="Failed to load chart data"
            description={revenueByPlan.error?.message}
          />
        ) : revenueByPlan.data && revenueByPlan.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByPlan.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plan" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No plan data" description="No revenue data by plan available for this date range." />
        )}

        {/* Churn: Canceled Subscriptions */}
        {churn.isLoading ? (
          <LoadingState variant="card" />
        ) : churn.isError ? (
          <ErrorState
            title="Failed to load chart data"
            description={churn.error?.message}
          />
        ) : churn.data && churn.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Churn: Canceled Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={churn.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="canceled" fill="#ff6b6b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No churn data" description="No churn data available for this date range." />
        )}
      </div>

      {/* Tables */}
      <div className="space-y-6">
        {/* Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions.isLoading ? (
              <LoadingState variant="table" />
            ) : subscriptions.isError ? (
              <ErrorState
                title="Failed to load subscriptions"
                description={subscriptions.error?.message}
              />
            ) : !subscriptions.data || subscriptions.data.length === 0 ? (
              <EmptyState
                title="No subscriptions"
                description="No subscriptions found."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Team</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Plan</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Status</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Period</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Canceled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.data.map((sub: any) => (
                      <tr key={sub.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <Link
                            href={`/teams/${sub.team_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {sub.team_id}
                          </Link>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline">{sub.plan}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                            {sub.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                        </td>
                        <td className="py-2 px-2">{sub.canceled_at ? formatDate(sub.canceled_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.isLoading ? (
              <LoadingState variant="table" />
            ) : invoices.isError ? (
              <ErrorState
                title="Failed to load invoices"
                description={invoices.error?.message}
              />
            ) : !invoices.data || invoices.data.length === 0 ? (
              <EmptyState
                title="No invoices"
                description="No invoices found."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Team</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Status</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Due Date</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.data.map((inv: any) => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <Link
                            href={`/teams/${inv.team_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {inv.team_id}
                          </Link>
                        </td>
                        <td className="py-2 px-2 text-right font-medium">{formatCurrency(inv.amount_usd)}</td>
                        <td className="py-2 px-2">
                          <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">{formatDate(inv.due_date)}</td>
                        <td className="py-2 px-2">{inv.paid_at ? formatDate(inv.paid_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.isLoading ? (
              <LoadingState variant="table" />
            ) : payments.isError ? (
              <ErrorState
                title="Failed to load payments"
                description={payments.error?.message}
              />
            ) : !payments.data || payments.data.length === 0 ? (
              <EmptyState
                title="No payments"
                description="No payments found."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Team</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Provider</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.data.map((payment: any) => (
                      <tr key={payment.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <Link
                            href={`/teams/${payment.team_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {payment.team_id}
                          </Link>
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {formatCurrency(payment.amount_usd)}
                        </td>
                        <td className="py-2 px-2">{payment.provider}</td>
                        <td className="py-2 px-2">{formatDate(payment.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent>
            {credits.isLoading ? (
              <LoadingState variant="table" />
            ) : credits.isError ? (
              <ErrorState
                title="Failed to load credits"
                description={credits.error?.message}
              />
            ) : !credits.data || credits.data.length === 0 ? (
              <EmptyState
                title="No credits"
                description="No credits found."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Team</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Type</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Created</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credits.data.map((credit: any) => (
                      <tr key={credit.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <Link
                            href={`/teams/${credit.team_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {credit.team_id}
                          </Link>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline">{credit.type}</Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-medium">{formatCurrency(credit.amount_usd)}</td>
                        <td className="py-2 px-2">{formatDate(credit.created_at)}</td>
                        <td className="py-2 px-2">{credit.expires_at ? formatDate(credit.expires_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
