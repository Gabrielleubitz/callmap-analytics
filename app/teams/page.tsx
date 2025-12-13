"use client"

/**
 * Teams Page - Redesigned
 * 
 * New layout:
 * 1. Filter bar with search, dropdowns, chips, and summary
 * 2. Card-based list instead of table
 * 3. Collapsible details panel for each team
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate, formatNumber } from "@/lib/utils"
import { getTeams, Plan, SubscriptionStatus, TeamsParams } from "@/lib/db"
import { TeamListCard } from "@/components/teams/team-list-card"
import { FilterChips, FilterChip } from "@/components/filters/filter-chips"
import { usePaginatedApi } from "@/lib/hooks/usePaginatedApi"

export default function TeamsPage() {
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState<Plan | "">("")
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">("")
  const [countryFilter, setCountryFilter] = useState("")

  // Build filters object
  const filters: Partial<TeamsParams> = useMemo(() => {
    const f: Partial<TeamsParams> = {}
    if (search) f.search = search
    if (planFilter) f.plan = [planFilter as Plan]
    if (statusFilter) {
      // Map status filter to is_active
      // This is a simplified mapping - you may need to adjust based on your data
    }
    if (countryFilter) f.country = [countryFilter]
    return f
  }, [search, planFilter, statusFilter, countryFilter])

  // Memoize the fetcher function to prevent infinite loops
  const fetcher = useCallback(
    (params: any) => getTeams({ ...filters, ...params }),
    [filters]
  )

  // Fetch teams using paginated hook
  const {
    items: teams,
    total,
    isLoading,
    isError,
    error,
    page,
    setPage,
    pageSize,
    refetch,
  } = usePaginatedApi(fetcher, { page: 1, pageSize: 20 })

  // Build active filter chips
  const activeFilters: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = []
    if (planFilter) {
      chips.push({ key: "plan", label: "Plan", value: planFilter })
    }
    if (statusFilter) {
      chips.push({ key: "status", label: "Status", value: statusFilter })
    }
    if (countryFilter) {
      chips.push({ key: "country", label: "Country", value: countryFilter })
    }
    return chips
  }, [planFilter, statusFilter, countryFilter])

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!teams) return { teamCount: 0, plans: new Set<string>(), countries: new Set<string>() }
    
    const plans = new Set<string>()
    const countries = new Set<string>()
    
    teams.forEach(team => {
      if (team.plan) plans.add(team.plan)
      if (team.country) countries.add(team.country)
    })
    
    return {
      teamCount: total,
      plans,
      countries
    }
  }, [teams, total])

  const handleRemoveFilter = (key: string) => {
    if (key === "plan") setPlanFilter("")
    if (key === "status") setStatusFilter("")
    if (key === "country") setCountryFilter("")
  }

  const handleClearAll = () => {
    setSearch("")
    setPlanFilter("")
    setStatusFilter("")
    setCountryFilter("")
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Team Management</h1>
        <p className="text-gray-600 text-sm max-w-3xl">
          Manage all teams (workspaces) in your platform. Each team represents a group of users working together. 
          Filter by plan (Free, Pro, Team, Enterprise) or status. Click on any team to view members, usage, billing, and detailed analytics.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Dropdowns */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as Plan | "")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="team">Team</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "active" | "inactive" | "")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Input
              placeholder="Country"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <FilterChips
              filters={activeFilters}
              onRemove={handleRemoveFilter}
              onClearAll={handleClearAll}
            />
          )}

          {/* Summary Strip */}
          <div className="text-sm text-gray-600 border-t pt-3">
            <span className="font-medium">{summary.teamCount}</span> Teams
            {summary.plans.size > 0 && (
              <>
                {" • "}
                <span className="font-medium">{summary.plans.size}</span> Plans
              </>
            )}
            {summary.countries.size > 0 && (
              <>
                {" • "}
                <span className="font-medium">{summary.countries.size}</span> Countries
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Teams List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <LoadingState key={i} variant="card" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load teams"
          description={error?.message || "Unable to fetch teams. Please try again."}
          onRetry={refetch}
        />
      ) : !teams || teams.length === 0 ? (
        <EmptyState
          title="No teams found"
          description={search || planFilter || statusFilter || countryFilter
            ? "No teams match the selected filters. Try adjusting your search criteria."
            : "No teams have been created yet."}
        />
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {teams.map((team) => (
              <TeamListCard
                key={team.id}
                team={{
                  id: team.id,
                  name: team.name,
                  owner_email: team.owner_user_id, // Will need to fetch actual email
                  created_at: team.created_at,
                  plan: team.plan,
                  status: team.is_active ? "active" : "inactive",
                  tokens_used_this_month: 0, // Will need to fetch from API
                  sessions_this_month: 0, // Will need to fetch from API
                  country: team.country || undefined,
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page * pageSize >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
