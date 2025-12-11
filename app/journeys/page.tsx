"use client"

import { useState, useEffect, useRef } from "react"
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
import { getJourney, searchUsers, type UserSearchResult } from "@/lib/db"
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const searchRef = useRef<HTMLDivElement>(null)

  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  // Auto-search as user types (optional - can be disabled if manual search is preferred)
  useEffect(() => {
    if (entityType !== 'user' || !searchQuery || searchQuery.length < 2) {
      // Don't clear results immediately, let user see them
      return
    }

    // Debounce auto-search (only if user hasn't clicked search button)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Auto-search after 500ms of no typing
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      setShowSearchResults(true)
      try {
        console.log('[Journey Search] Auto-searching for:', searchQuery)
        const results = await searchUsers(searchQuery, 10)
        console.log('[Journey Search] Auto-search results:', results)
        setSearchResults(results)
      } catch (error) {
        console.error('[Journey Search] Auto-search error:', error)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, entityType])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleManualSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      return
    }

    setSearching(true)
    setShowSearchResults(true)
    try {
      console.log('[Journey Search] Manual search for:', searchQuery)
      const results = await searchUsers(searchQuery, 10)
      console.log('[Journey Search] Results:', results)
      setSearchResults(results)
      if (results.length === 0) {
        // Keep showing "no results" message
      }
    } catch (error) {
      console.error('[Journey Search] Error:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleUserSelect = (user: UserSearchResult) => {
    setEntityId(user.id)
    setSearchQuery(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email)
    setShowSearchResults(false)
  }

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

            <div ref={searchRef} className="relative">
              <Label htmlFor="entityId">
                {entityType === 'user' ? 'User (Name or Email)' : 'Team ID'}
              </Label>
              {entityType === 'user' ? (
                <>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 relative">
                      <Input
                        id="entityId"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          if (!e.target.value) {
                            setEntityId('')
                            setSearchResults([])
                            setShowSearchResults(false)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleManualSearch()
                          }
                        }}
                        onFocus={() => {
                          if (searchResults.length > 0) {
                            setShowSearchResults(true)
                          }
                        }}
                        placeholder="Search by name or email..."
                        className="pr-10"
                      />
                      {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleManualSearch}
                      disabled={!searchQuery || searchQuery.length < 2 || searching}
                      className="whitespace-nowrap"
                    >
                      {searching ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleUserSelect(user)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{displayName}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {searchQuery && searchQuery.length >= 2 && !searching && searchResults.length === 0 && showSearchResults && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-gray-500">
                      No users found matching &quot;{searchQuery}&quot;. Check the browser console and server logs for details.
                    </div>
                  )}
                  {searchQuery && searchQuery.length >= 2 && !searching && !showSearchResults && (
                    <p className="mt-1 text-xs text-gray-400">
                      Press Enter or click Search to find users
                    </p>
                  )}
                  {entityId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Selected User ID: {entityId}
                    </p>
                  )}
                </>
              ) : (
                <Input
                  id="entityId"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="Enter team ID"
                  className="mt-2"
                />
              )}
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

