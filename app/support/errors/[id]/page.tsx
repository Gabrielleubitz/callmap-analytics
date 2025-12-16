"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { SupportErrorEvent, SupportErrorTriage, TriageStatus, ResolutionType } from "@/lib/types"

export default function ErrorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const errorId = params.id as string

  const [error, setError] = useState<SupportErrorEvent | null>(null)
  const [triage, setTriage] = useState<SupportErrorTriage | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Resolution form
  const [resolutionType, setResolutionType] = useState<ResolutionType | "">("")
  const [resolutionNotes, setResolutionNotes] = useState("")

  useEffect(() => {
    async function fetchError() {
      setLoading(true)
      setErrorState(null)
      try {
        const response = await fetch(`/api/support/errors/${errorId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch error')
        }
        const data = await response.json()
        setError(data.error)
        setTriage(data.triage)
        if (data.error.resolution_type) {
          setResolutionType(data.error.resolution_type)
        }
        if (data.error.resolution_notes) {
          setResolutionNotes(data.error.resolution_notes)
        }
      } catch (err: any) {
        setErrorState(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (errorId) {
      fetchError()
    }
  }, [errorId])

  const handleAcknowledge = async () => {
    try {
      const response = await fetch(`/api/support/errors/${errorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true }),
      })
      if (response.ok) {
        router.refresh()
        if (error) {
          setError({ ...error, acknowledged_at: new Date() })
        }
      }
    } catch (err) {
      console.error('[ErrorDetail] Failed to acknowledge:', err)
    }
  }

  const handleResolve = async () => {
    if (!resolutionType) {
      alert('Please select a resolution type')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/support/errors/${errorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triage_status: 'done',
          resolution_type: resolutionType,
          resolution_notes: resolutionNotes,
        }),
      })
      if (response.ok) {
        router.push('/support/errors')
      } else {
        throw new Error('Failed to resolve error')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to resolve error')
    } finally {
      setSaving(false)
    }
  }

  const handleEscalate = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/support/errors/${errorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triage_status: 'escalated' }),
      })
      if (response.ok) {
        router.push('/support/errors')
      } else {
        throw new Error('Failed to escalate error')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to escalate error')
    } finally {
      setSaving(false)
    }
  }

  const handleIgnore = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/support/errors/${errorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triage_status: 'ignored',
          resolution_type: 'ignored',
        }),
      })
      if (response.ok) {
        router.push('/support/errors')
      } else {
        throw new Error('Failed to ignore error')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to ignore error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  if (errorState || !error) {
    return <ErrorState description={errorState || 'Error not found'} />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/support/errors"
          className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
        >
          ← Back to Errors Inbox
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Details</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Error Details */}
          <Card>
            <CardHeader>
              <CardTitle>What Happened</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Message</div>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                  {error.message}
                </div>
              </div>

              {error.stack && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Stack Trace</div>
                  <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md overflow-x-auto">
                    {error.stack}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">App Area</div>
                  <div className="text-sm text-gray-900">{error.app_area}</div>
                </div>
                {error.route && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Route</div>
                    <div className="text-sm text-gray-900">{error.route}</div>
                  </div>
                )}
                {error.action && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Action</div>
                    <div className="text-sm text-gray-900">{error.action}</div>
                  </div>
                )}
                {error.error_code && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Error Code</div>
                    <div className="text-sm text-gray-900">{error.error_code}</div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Badge
                  variant={
                    error.severity === 'critical'
                      ? 'destructive'
                      : error.severity === 'warning'
                      ? 'default'
                      : 'outline'
                  }
                >
                  {error.severity}
                </Badge>
                {error.expected ? (
                  <Badge variant="outline">Expected</Badge>
                ) : (
                  <Badge variant="default">Unexpected</Badge>
                )}
                {error.critical && <Badge variant="destructive">Critical</Badge>}
                <Badge variant="outline">{error.source}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Occurrences</div>
                  <div className="text-sm text-gray-900">{error.occurrence_count}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">First Seen</div>
                  <div className="text-sm text-gray-900">{formatDate(error.first_seen_at)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Last Seen</div>
                  <div className="text-sm text-gray-900">{formatDate(error.last_seen_at)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Status</div>
                  <Badge variant="outline">{error.triage_status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Triage */}
          {triage && (
            <Card>
              <CardHeader>
                <CardTitle>AI Triage Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Summary</div>
                  <div className="text-sm text-gray-900">{triage.summary}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Probable Causes</div>
                  <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                    {triage.probable_causes.map((cause, i) => (
                      <li key={i}>{cause}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Recommended Fixes</div>
                  <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                    {triage.recommended_fixes.map((fix, i) => (
                      <li key={i}>{fix}</li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Who Should Act</div>
                    <Badge variant="outline">{triage.who_should_act}</Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Confidence</div>
                    <div className="text-sm text-gray-900">
                      {Math.round(triage.confidence * 100)}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Customer-Facing Message</div>
                  <div className="text-sm text-gray-900 bg-blue-50 p-3 rounded-md">
                    {triage.customer_facing_message}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resolution Form */}
          <Card>
            <CardHeader>
              <CardTitle>Resolution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Resolution Type</div>
                <Select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value as ResolutionType)}
                >
                  <option value="">Select resolution type</option>
                  <option value="user_action">User Action</option>
                  <option value="engineering_fix">Engineering Fix</option>
                  <option value="config_change">Configuration Change</option>
                  <option value="ignored">Ignore</option>
                </Select>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Resolution Notes</div>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about how this was resolved..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleResolve}
                  disabled={!resolutionType || saving}
                  variant="default"
                >
                  Mark Resolved
                </Button>
                <Button
                  onClick={handleEscalate}
                  disabled={saving}
                  variant="outline"
                >
                  Escalate to Engineering
                </Button>
                <Button
                  onClick={handleIgnore}
                  disabled={saving}
                  variant="outline"
                >
                  Ignore
                </Button>
                {!error.acknowledged_at && (
                  <Button
                    onClick={handleAcknowledge}
                    variant="outline"
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Who is Affected */}
          <Card>
            <CardHeader>
              <CardTitle>Who is Affected</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error.user_id && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">User</div>
                  <Link
                    href={`/users/${error.user_id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View User Profile
                  </Link>
                </div>
              )}
              {error.workspace_id && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Workspace</div>
                  <Link
                    href={`/teams/${error.workspace_id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View Workspace
                  </Link>
                </div>
              )}
              {!error.user_id && !error.workspace_id && (
                <div className="text-sm text-gray-500">No user or workspace context</div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          {error.metadata && Object.keys(error.metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(error.metadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

