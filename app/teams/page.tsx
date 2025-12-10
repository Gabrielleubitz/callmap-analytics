"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Select } from "@/components/ui/select"
import { formatDate, formatNumber } from "@/lib/utils"
import { getTeams, Plan, SubscriptionStatus, TeamsParams } from "@/lib/db"
import Link from "next/link"

export default function TeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [filters, setFilters] = useState<Partial<TeamsParams>>({
    search: "",
    plan: undefined,
    country: undefined,
    subscriptionStatus: undefined,
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getTeams({
        page,
        pageSize,
        ...filters,
      })
      setTeams(result.data)
      setTotal(result.total)
      setLoading(false)
    }
    load()
  }, [page, filters])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input
              placeholder="Search teams..."
              value={filters.search || ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <Select
              value={filters.plan?.[0] || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  plan: e.target.value ? [e.target.value as Plan] : undefined,
                })
              }
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="team">Team</option>
              <option value="enterprise">Enterprise</option>
            </Select>
            <Input
              placeholder="Country"
              value={filters.country?.[0] || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  country: e.target.value ? [e.target.value] : undefined,
                })
              }
            />
            <Select
              value={filters.subscriptionStatus?.[0] || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  subscriptionStatus: e.target.value
                    ? [e.target.value as SubscriptionStatus]
                    : undefined,
                })
              }
            >
              <option value="">All Statuses</option>
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Teams ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : teams.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No teams found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow
                      key={team.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/teams/${team.id}`)}
                    >
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{team.plan}</Badge>
                      </TableCell>
                      <TableCell>{team.country || "-"}</TableCell>
                      <TableCell>{team.owner_user_id}</TableCell>
                      <TableCell>{formatDate(team.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={team.is_active ? "default" : "secondary"}>
                          {team.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

