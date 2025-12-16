"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { SupportErrorEvent, TriageStatus, ErrorSeverity } from "@/lib/types"

export default function SupportErrorsPage() {
  const [errors, setErrors] = useState<SupportErrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // Filters
  const [expectedFilter, setExpectedFilter] = useState<boolean | null>(null)
  const [criticalFilter, setCriticalFilter] = useState<boolean | null>(null)
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | "">("")
  const [appAreaFilter, setAppAreaFilter] = useState("")
  const [triageStatusFilter, setTriageStatusFilter] = useState<TriageStatus | "">("")
  const [unresolvedOnly, setUnresolvedOnly] = useState(true)

  const fetchErrors = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/support/errors/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          pageSize,
          expected: expectedFilter !== null ? expectedFilter : undefined,
          critical: criticalFilter !== null ? criticalFilter : undefined,
          severity: severityFilter || undefined,
          app_area: appAreaFilter || undefined,
          triage_status: triageStatusFilter || undefined,
          unresolved_only: unresolvedOnly,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch errors')
      }

      const data = await response.json()
      setErrors(data.items || data.data || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, expectedFilter, criticalFilter, severityFilter, appAreaFilter, triageStatusFilter, unresolvedOnly])

  const appAreas = useMemo(() => {
    const areas = new Set<string>()
    errors.forEach(e => {
      if (e.app_area) areas.add(e.app_area)
    })
    return Array.from(areas).sort()
  }, [errors])

  if (loading && errors.length === 0) {
    return <LoadingState />
  }

  if (error && errors.length === 0) {
    return <ErrorState description={error} onRetry={fetchErrors} />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Errors Inbox</h1>
        <p className="text-sm text-gray-600">
          Monitor and resolve user-facing errors across CallMap
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              value={expectedFilter === null ? "all" : expectedFilter ? "expected" : "unexpected"}
              onChange={(e) => {
                const value = e.target.value
                if (value === "all") setExpectedFilter(null)
                else setExpectedFilter(value === "expected")
              }}
            >
              <option value="all">All</option>
              <option value="expected">Expected</option>
              <option value="unexpected">Unexpected</option>
            </Select>

            <Select
              value={criticalFilter === null ? "all" : criticalFilter ? "critical" : "non-critical"}
              onChange={(e) => {
                const value = e.target.value
                if (value === "all") setCriticalFilter(null)
                else setCriticalFilter(value === "critical")
              }}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="non-critical">Non-Critical</option>
            </Select>

            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as ErrorSeverity | "")}
            >
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>

            <Select
              value={triageStatusFilter}
              onChange={(e) => setTriageStatusFilter(e.target.value as TriageStatus | "")}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="done">Done</option>
              <option value="ignored">Ignored</option>
              <option value="escalated">Escalated</option>
            </Select>

            {appAreas.length > 0 && (
              <Select
                value={appAreaFilter}
                onChange={(e) => setAppAreaFilter(e.target.value)}
              >
                <option value="">All</option>
                {appAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </Select>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="unresolved-only"
                checked={unresolvedOnly}
                onChange={(e) => setUnresolvedOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="unresolved-only" className="text-sm text-gray-700">
                Unresolved only
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors Table */}
      {errors.length === 0 ? (
        <EmptyState title="No errors found" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Errors ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Severity</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Expected</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Critical</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">App Area</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Message</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Occurrences</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Seen</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err) => (
                    <tr
                      key={err.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            err.severity === 'critical'
                              ? 'destructive'
                              : err.severity === 'warning'
                              ? 'default'
                              : 'outline'
                          }
                        >
                          {err.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {err.expected ? (
                          <Badge variant="outline">Expected</Badge>
                        ) : (
                          <Badge variant="default">Unexpected</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {err.critical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{err.app_area}</td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/support/errors/${err.id}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {err.message.substring(0, 60)}
                          {err.message.length > 60 ? '...' : ''}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{err.occurrence_count}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {formatDate(err.last_seen_at)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{err.triage_status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > pageSize && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

