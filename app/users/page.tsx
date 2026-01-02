"use client"

/**
 * Users Page - Redesigned
 * 
 * New layout:
 * 1. Filter bar with search, dropdowns, chips, and summary
 * 2. Card-based list instead of table
 * 3. Collapsible details panel for each user
 */

import { useState, useMemo, useCallback, useEffect } from "react"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/date-range-picker"
import { getUsers, UserRole, UserStatus, UsersParams, getUserLifecycleAnalytics, DateRange } from "@/lib/db"
import { UserListCard } from "@/components/users/user-list-card"
import { FilterChips, FilterChip } from "@/components/filters/filter-chips"
import { usePaginatedApi } from "@/lib/hooks/usePaginatedApi"
import { useApiData } from "@/lib/hooks/useApiData"
import { HeroMetricCard } from "@/components/metrics/hero-metric-card"
import { MetricGroupCard } from "@/components/metrics/metric-group-card"
import { formatNumber } from "@/lib/utils"
import { Users, TrendingUp, CheckCircle, AlertCircle } from "lucide-react"

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("")
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("")
  const [hasLoggedInFilter, setHasLoggedInFilter] = useState<"yes" | "no" | "">("")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [adminUsers, setAdminUsers] = useState<Map<string, { isAdmin: boolean; role: string | null }>>(new Map())
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  // Fetch user lifecycle metrics
  const lifecycleMetrics = useApiData(() => getUserLifecycleAnalytics(dateRange), [dateRange])

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

  // Check if current user is superAdmin and fetch admin status for all users
  useEffect(() => {
    async function loadAdminStatus() {
      try {
        // Check current user's role
        const sessionResponse = await fetch('/api/auth/session')
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json()
          if (sessionData.authenticated && sessionData.role === 'superAdmin') {
            setIsSuperAdmin(true)
          }
        }

        // Fetch admin status for all Firebase users
        const adminResponse = await fetch('/api/admin/users')
        if (adminResponse.ok) {
          const adminData = await adminResponse.json()
          const adminMap = new Map<string, { isAdmin: boolean; role: string | null }>()
          adminData.users?.forEach((u: any) => {
            adminMap.set(u.uid, { isAdmin: u.isAdmin, role: u.role })
          })
          setAdminUsers(adminMap)
        }
      } catch (error) {
        console.error('Error loading admin status:', error)
      } finally {
        setLoadingAdminStatus(false)
      }
    }
    loadAdminStatus()
  }, [])

  const handleAccessChange = () => {
    // Reload admin status after access change
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        const adminMap = new Map<string, { isAdmin: boolean; role: string | null }>()
        data.users?.forEach((u: any) => {
          adminMap.set(u.uid, { isAdmin: u.isAdmin, role: u.role })
        })
        setAdminUsers(adminMap)
      })
      .catch(err => console.error('Error reloading admin status:', err))
  }

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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600 text-sm max-w-3xl">
              View and manage all users in your platform. Search by name or email, filter by role (Owner, Admin, Member) or status (Active, Invited, Disabled). 
              {isSuperAdmin && " As a super admin, you can grant or revoke analytics dashboard access by expanding any user card. "}
              Click on any user card to see detailed information including their activity, token balance, and session history.
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* User Lifecycle Metrics */}
      {lifecycleMetrics.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <LoadingState key={i} variant="card" />
          ))}
        </div>
      ) : lifecycleMetrics.isError ? (
        <ErrorState
          title="Failed to load lifecycle metrics"
          description={lifecycleMetrics.error?.message}
          onRetry={lifecycleMetrics.refetch}
        />
      ) : lifecycleMetrics.data ? (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <HeroMetricCard
              title="Total Users"
              value={formatNumber(lifecycleMetrics.data.totalUsers)}
              icon={<Users className="h-5 w-5" />}
            />
            <HeroMetricCard
              title="New Signups"
              value={formatNumber(lifecycleMetrics.data.newSignups)}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <HeroMetricCard
              title="Activation Rate"
              value={`${lifecycleMetrics.data.activationRate.toFixed(1)}%`}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <HeroMetricCard
              title="Onboarding Rate"
              value={`${lifecycleMetrics.data.onboardingCompletionRate.toFixed(1)}%`}
              icon={<CheckCircle className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricGroupCard
                  title=""
                  metrics={[
                    { label: "Daily Active Users (DAU)", value: formatNumber(lifecycleMetrics.data.dau) },
                    { label: "Weekly Active Users (WAU)", value: formatNumber(lifecycleMetrics.data.wau) },
                    { label: "Monthly Active Users (MAU)", value: formatNumber(lifecycleMetrics.data.mau) },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Churn Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricGroupCard
                  title=""
                  metrics={[
                    { label: "30-Day Churn", value: formatNumber(lifecycleMetrics.data.churn30d) },
                    { label: "60-Day Churn", value: formatNumber(lifecycleMetrics.data.churn60d) },
                    { label: "90-Day Churn", value: formatNumber(lifecycleMetrics.data.churn90d) },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {Object.keys(lifecycleMetrics.data.planDistribution || {}).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(lifecycleMetrics.data.planDistribution).map(([plan, count]) => (
                    <Badge key={plan} variant="outline" className="text-sm">
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}: {formatNumber(count as number)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

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
            {users.map((user) => {
              const adminStatus = adminUsers.get(user.id) || { isAdmin: false, role: null }
              return (
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
                  isAdmin={adminStatus.isAdmin}
                  adminRole={adminStatus.role}
                  isSuperAdmin={isSuperAdmin}
                  onAccessChange={handleAccessChange}
                />
              )
            })}
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

