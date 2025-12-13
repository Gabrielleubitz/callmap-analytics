"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { startOfDay, endOfDay, subDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils"
import {
  getTeamDetail,
  getTeamUsers,
  getTeamSessions,
  getTeamBilling,
  getTeamAPI,
  getTeamAuditLogs,
  DateRange,
} from "@/lib/db"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"

export default function TeamDetailPage() {
  const params = useParams()
  const teamId = params.id as string
  const [team, setTeam] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [billing, setBilling] = useState<any>(null)
  const [api, setApi] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [dateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  })

  useEffect(() => {
    async function load() {
      const [t, u, s, b, a, al] = await Promise.all([
        getTeamDetail(teamId, dateRange),
        getTeamUsers(teamId, { page: 1, pageSize: 100 }),
        getTeamSessions(teamId, { page: 1, pageSize: 100 }),
        getTeamBilling(teamId),
        getTeamAPI(teamId),
        getTeamAuditLogs(teamId, { page: 1, pageSize: 100 }),
      ])
      setTeam(t)
      setUsers(u.data)
      setSessions(s.data)
      setBilling(b)
      setApi(a)
      setAuditLogs(al.data)
    }
    if (teamId) load()
  }, [teamId, dateRange])

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/teams" className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to Teams
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">{team.plan}</Badge>
              <Badge variant={team.is_active ? "default" : "secondary"}>
                {team.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className="text-sm text-gray-500">Created {formatDate(team.created_at)}</span>
            </div>
          </div>
        </div>
        <p className="text-gray-600 text-sm max-w-3xl">
          Detailed view of this team&apos;s activity, members, usage, billing, and API access. Use the tabs below to explore different aspects. 
          Monitor token usage, session activity, subscription status, and team engagement.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sessions (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tokens This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Lifetime Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (billing?.payments || []).reduce((sum: number, p: any) => sum + p.amount_usd, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tokens Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="tokens" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "-"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "secondary"}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.last_activity_at ? formatDate(user.last_activity_at) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-xs">{session.id.slice(0, 8)}</TableCell>
                      <TableCell>{session.source_type}</TableCell>
                      <TableCell>
                        <Badge variant={session.status === "ready" ? "default" : "secondary"}>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {session.tokens_in && session.tokens_out
                          ? formatNumber((session.tokens_in || 0) + (session.tokens_out || 0))
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {session.cost_usd ? formatCurrency(session.cost_usd) : "-"}
                      </TableCell>
                      <TableCell>{formatDate(session.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Canceled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(billing?.subscriptions || []).map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <Badge variant="outline">{sub.plan}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                        </TableCell>
                        <TableCell>{sub.canceled_at ? formatDate(sub.canceled_at) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(billing?.invoices || []).map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{formatCurrency(inv.amount_usd)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(inv.due_date)}</TableCell>
                        <TableCell>{inv.paid_at ? formatDate(inv.paid_at) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(api?.apiKeys || []).map((key: any) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>{key.last_used_at ? formatDate(key.last_used_at) : "Never"}</TableCell>
                        <TableCell>
                          <Badge variant={key.is_active ? "default" : "secondary"}>
                            {key.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhook Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Last Success</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(api?.webhookEndpoints || []).map((endpoint: any) => (
                      <TableRow key={endpoint.id}>
                        <TableCell className="font-mono text-xs">{endpoint.url}</TableCell>
                        <TableCell>{endpoint.event_types.join(", ")}</TableCell>
                        <TableCell>
                          {endpoint.last_success_at ? formatDate(endpoint.last_success_at) : "Never"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={endpoint.is_active ? "default" : "secondary"}>
                            {endpoint.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>
                        {log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell>{log.user_id || "-"}</TableCell>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

