"use client"

import { useState } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { DateRangePicker } from "@/components/date-range-picker"
import { formatDateTime } from "@/lib/utils"
import { useApiData } from "@/lib/hooks/useApiData"
import { getJourney } from "@/lib/db"
import type { DateRange } from "@/lib/types"
import { Upload, Zap, Edit, Download, AlertTriangle, TrendingUp, MessageSquare, XCircle } from "lucide-react"

const EVENT_ICONS: Record<string, any> = {
  upload: Upload,
  generate: Zap,
  edit: Edit,
  export: Download,
  quotaHit: AlertTriangle,
  upgrade: TrendingUp,
  error: XCircle,
  collaboration: MessageSquare,
  note: MessageSquare,
}

const EVENT_COLORS: Record<string, string> = {
  upload: 'text-blue-600',
  generate: 'text-green-600',
  edit: 'text-purple-600',
  export: 'text-orange-600',
  quotaHit: 'text-red-600',
  upgrade: 'text-emerald-600',
  error: 'text-red-600',
  collaboration: 'text-indigo-600',
  note: 'text-gray-600',
}

export default function JourneysPage() {
  const [entityType, setEntityType] = useState<'user' | 'team'>('user')
  const [entityId, setEntityId] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  const journey = useApiData(
    () => {
      if (!entityId) return Promise.resolve(null)
      return getJourney(entityType, entityId, dateRange)
    },
    [entityType, entityId, dateRange.start.toISOString(), dateRange.end.toISOString()]
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Journey Explorer</h1>
        <p className="mt-2 text-gray-600">
          Explore chronological timeline of events for users or teams
        </p>
      </div>

      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Journey</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Entity Type</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  variant={entityType === 'user' ? 'default' : 'outline'}
                  onClick={() => setEntityType('user')}
                >
                  User
                </Button>
                <Button
                  variant={entityType === 'team' ? 'default' : 'outline'}
                  onClick={() => setEntityType('team')}
                >
                  Team
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="entityId">
                {entityType === 'user' ? 'User ID' : 'Team ID'}
              </Label>
              <Input
                id="entityId"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder={entityType === 'user' ? 'Enter user ID' : 'Enter team ID'}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Date Range</Label>
              <div className="mt-2">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                />
              </div>
            </div>

            <div className="text-sm text-gray-500">
              {entityId ? 'Results will load automatically' : 'Enter an ID to search'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journey Timeline */}
      {entityId && (
        <Card>
          <CardHeader>
            <CardTitle>
              {entityType === 'user' ? 'User' : 'Team'} Journey Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {journey.isLoading ? (
              <LoadingState variant="card" />
            ) : journey.isError ? (
              <ErrorState
                title="Failed to load journey"
                description={journey.error?.message}
                variant="banner"
              />
            ) : !journey.data || journey.data.events.length === 0 ? (
              <EmptyState
                title="No events found"
                description={`No events found for this ${entityType} in the selected date range.`}
              />
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Found {journey.data.count} events
                </div>

                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300" />

                  {/* Events */}
                  <div className="space-y-6">
                    {journey.data.events.map((event: any, index: number) => {
                      const Icon = EVENT_ICONS[event.type] || Zap
                      const color = EVENT_COLORS[event.type] || 'text-gray-600'

                      return (
                        <div key={event.id || index} className="relative flex items-start gap-4">
                          {/* Timeline dot */}
                          <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 ${color.replace('text-', 'border-')}`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>

                          {/* Event content */}
                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-900">
                                    {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatDateTime(new Date(event.timestamp))}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700">{event.description}</p>
                                {event.metadata && Object.keys(event.metadata).length > 0 && (
                                  <div className="mt-2 text-xs text-gray-500">
                                    {Object.entries(event.metadata).map(([key, value]) => (
                                      <span key={key} className="mr-4">
                                        {key}: {String(value)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

