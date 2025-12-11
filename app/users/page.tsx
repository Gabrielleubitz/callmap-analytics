"use client"

/**
 * Users Page - Redesigned
 * 
 * New layout:
 * 1. Filter bar with search, dropdowns, chips, and summary
 * 2. Card-based list instead of table
 * 3. Collapsible details panel for each user
 */

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { getUsers, UserRole, UserStatus, UsersParams } from "@/lib/db"
import { UserListCard } from "@/components/users/user-list-card"
import { FilterChips, FilterChip } from "@/components/filters/filter-chips"
import { usePaginatedApi } from "@/lib/hooks/usePaginatedApi"

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("")
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("")
  const [hasLoggedInFilter, setHasLoggedInFilter] = useState<"yes" | "no" | "">("")

  // Build filters object
  const filters: Partial<UsersParams> = useMemo(() => {
    const f: Partial<UsersParams> = {}
    if (search) f.search = search
    if (roleFilter) f.role = [roleFilter]
    if (statusFilter) f.status = [statusFilter]
    if (hasLoggedInFilter === "yes") f.hasLoggedIn = true
    if (hasLoggedInFilter === "no") f.hasLoggedIn = false
    return f
  }, [search, roleFilter, statusFilter, hasLoggedInFilter])

  // Memoize the fetcher function to prevent infinite loops
  const fetcher = useCallback(
    (params: any) => getUsers({ ...filters, ...params }),
    [filters]
  )

  // Fetch users using paginated hook
  const {
    items: users,
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
    if (roleFilter) {
      chips.push({ key: "role", label: "Role", value: roleFilter })
    }
    if (statusFilter) {
      chips.push({ key: "status", label: "Status", value: statusFilter })
    }
    if (hasLoggedInFilter) {
      chips.push({ key: "hasLoggedIn", label: "Has Logged In", value: hasLoggedInFilter === "yes" ? "Yes" : "No" })
    }
    return chips
  }, [roleFilter, statusFilter, hasLoggedInFilter])

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!users) return { userCount: 0, roles: new Set<string>(), statuses: new Set<string>() }
    
    const roles = new Set<string>()
    const statuses = new Set<string>()
    
    users.forEach(user => {
      if (user.role) roles.add(user.role)
      if (user.status) statuses.add(user.status)
    })
    
    return {
      userCount: total,
      roles,
      statuses
    }
  }, [users, total])

  const handleRemoveFilter = (key: string) => {
    if (key === "role") setRoleFilter("")
    if (key === "status") setStatusFilter("")
    if (key === "hasLoggedIn") setHasLoggedInFilter("")
  }

  const handleClearAll = () => {
    setSearch("")
    setRoleFilter("")
    setStatusFilter("")
    setHasLoggedInFilter("")
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
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
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | "")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="disabled">Disabled</option>
            </select>
            <select
              value={hasLoggedInFilter}
              onChange={(e) => setHasLoggedInFilter(e.target.value as "yes" | "no" | "")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="yes">Has Logged In</option>
              <option value="no">Never Logged In</option>
            </select>
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
            <span className="font-medium">{summary.userCount}</span> Users
            {summary.roles.size > 0 && (
              <>
                {" • "}
                <span className="font-medium">{summary.roles.size}</span> Roles
              </>
            )}
            {summary.statuses.size > 0 && (
              <>
                {" • "}
                <span className="font-medium">{summary.statuses.size}</span> Statuses
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <LoadingState key={i} variant="card" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load users"
          description={error?.message || "Unable to fetch users. Please try again."}
          onRetry={refetch}
        />
      ) : !users || users.length === 0 ? (
        <EmptyState
          title="No users found"
          description={search || roleFilter || statusFilter || hasLoggedInFilter
            ? "No users match the selected filters. Try adjusting your search criteria."
            : "No users have been created yet."}
        />
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {users.map((user) => (
              <UserListCard
                key={user.id}
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  team_id: user.team_id,
                  role: user.role,
                  status: user.status,
                  created_at: user.created_at,
                  last_login_at: user.last_login_at,
                  last_activity_at: user.last_activity_at,
                  tokenBalance: user.tokenBalance,
                  audioMinutesUsed: user.audioMinutesUsed,
                  mapsGenerated: user.mapsGenerated,
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
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

