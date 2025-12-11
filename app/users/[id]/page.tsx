"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatNumber, getInitials } from "@/lib/utils"
import {
  getUserDetail,
  getUserSessions,
  getUserAuditLogs,
  getUserFeatureFlags,
} from "@/lib/db"
import Link from "next/link"

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [featureFlags, setFeatureFlags] = useState<any[]>([])
  const [walletTransactions, setWalletTransactions] = useState<any[]>([])
  const [walletLoading, setWalletLoading] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isGrantingAccess, setIsGrantingAccess] = useState(false)
  const [userIsAdmin, setUserIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      // Check if current user is superAdmin and get target user admin status
      try {
        const response = await fetch('/api/admin/users')
        if (response.ok) {
          setIsSuperAdmin(true)
          const data = await response.json()
          const targetUser = data.users?.find((u: any) => u.uid === userId)
          if (targetUser) {
            setUserIsAdmin(targetUser.isAdmin || false)
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
      }

      const [u, s, al, ff] = await Promise.all([
        getUserDetail(userId),
        getUserSessions(userId, { page: 1, pageSize: 100 }),
        getUserAuditLogs(userId, { page: 1, pageSize: 100 }),
        getUserFeatureFlags(userId),
      ])
      setUser(u)
      setEditingUser(u ? { ...u } : null)
      setSessions(s.data)
      setAuditLogs(al.data)
      setFeatureFlags(ff)
      
      // Load wallet transactions
      try {
        setWalletLoading(true)
        const response = await fetch(`/api/admin/wallet/${userId}/transactions?pageSize=5`)
        if (response.ok) {
          const data = await response.json()
          setWalletTransactions(data.items || [])
        }
      } catch (error) {
        console.error("Error loading wallet transactions:", error)
      } finally {
        setWalletLoading(false)
      }
    }
    if (userId) load()
  }, [userId])

  const handleSave = async () => {
    if (!editingUser) return
    
    setIsSaving(true)
    try {
      const response = await fetch(`/api/users/${userId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingUser),
      })
      
      if (response.ok) {
        const updatedUser = await getUserDetail(userId)
        setUser(updatedUser)
        setEditingUser(updatedUser ? { ...updatedUser } : null)
        setIsEditing(false)
      } else {
        alert('Failed to save changes')
      }
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Error saving changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingUser(user ? { ...user } : null)
    setIsEditing(false)
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  const displayUser = isEditing ? editingUser : user

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/users" className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to Users
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl font-medium">
            {getInitials(displayUser.name || displayUser.email)}
          </div>
          <div>
            {isEditing ? (
              <Input
                value={displayUser.name || ''}
                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                className="text-2xl font-bold"
                placeholder="Name"
              />
            ) : (
              <h1 className="text-3xl font-bold text-gray-900">{displayUser.name || "No Name"}</h1>
            )}
            <div className="mt-1 flex items-center gap-2">
              {isEditing ? (
                <Input
                  value={displayUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-64"
                  type="email"
                />
              ) : (
                <span className="text-gray-600">{displayUser.email}</span>
              )}
              {!isEditing && (
                <>
                  <Badge variant="outline">{displayUser.role}</Badge>
                  <Badge variant={displayUser.status === "active" ? "default" : "secondary"}>
                    {displayUser.status}
              </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      {/* Editable User Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Data</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Email</label>
              {isEditing ? (
                <Input
                  value={displayUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="mt-1"
                  type="email"
                />
              ) : (
                <div className="mt-1 text-lg">{displayUser.email || '-'}</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Name</label>
              {isEditing ? (
                <Input
                  value={displayUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-lg">{displayUser.name || '-'}</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Plan</label>
              {isEditing ? (
                <select
                  value={displayUser.plan || 'free'}
                  onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="team">Team</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              ) : (
                <div className="mt-1 text-lg">
                  <Badge variant="outline">{displayUser.plan || 'free'}</Badge>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Token Balance</label>
              <div className="mt-1 text-lg font-bold">{formatNumber(displayUser.tokenBalance || 0)}</div>
              <p className="text-xs text-gray-500 mt-1">Use Wallet panel below to adjust balance</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Audio Minutes Used</label>
              {isEditing ? (
                <Input
                  value={displayUser.audioMinutesUsed || 0}
                  onChange={(e) => setEditingUser({ ...editingUser, audioMinutesUsed: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                  type="number"
                />
              ) : (
                <div className="mt-1 text-lg font-bold">{formatNumber(displayUser.audioMinutesUsed || 0)}</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Maps Generated</label>
              {isEditing ? (
                <Input
                  value={displayUser.mapsGenerated || 0}
                  onChange={(e) => setEditingUser({ ...editingUser, mapsGenerated: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                  type="number"
                />
              ) : (
                <div className="mt-1 text-lg font-bold">{formatNumber(displayUser.mapsGenerated || 0)}</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Onboarded</label>
              {isEditing ? (
                <select
                  value={displayUser.onboarded ? 'true' : 'false'}
                  onChange={(e) => setEditingUser({ ...editingUser, onboarded: e.target.value === 'true' })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <div className="mt-1 text-lg">
                  <Badge variant={displayUser.onboarded ? "default" : "secondary"}>
                    {displayUser.onboarded ? 'Yes' : 'No'}
                  </Badge>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Monthly Reset Timestamp</label>
              {isEditing ? (
                <Input
                  value={displayUser.monthlyResetTimestamp ? new Date(displayUser.monthlyResetTimestamp).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingUser({ ...editingUser, monthlyResetTimestamp: e.target.value })}
                  className="mt-1"
                  type="datetime-local"
                />
              ) : (
                <div className="mt-1 text-lg">
                  {displayUser.monthlyResetTimestamp ? formatDate(displayUser.monthlyResetTimestamp) : '-'}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Role</label>
              {isEditing ? (
                <select
                  value={displayUser.role || 'member'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              ) : (
                <div className="mt-1 text-lg">
                  <Badge variant="outline">{displayUser.role || 'member'}</Badge>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              {isEditing ? (
                <select
                  value={displayUser.status || 'active'}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="disabled">Disabled</option>
                </select>
              ) : (
                <div className="mt-1 text-lg">
                  <Badge variant={displayUser.status === "active" ? "default" : "secondary"}>
                    {displayUser.status || 'active'}
                  </Badge>
                </div>
              )}
            </div>

            {/* Admin Access Section */}
            {isSuperAdmin && (
              <div className="col-span-full border-t pt-4 mt-4">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Analytics Access</label>
                {userIsAdmin ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-purple-600">
                      ✓ Has Analytics Access
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!confirm('Revoke analytics access for this user?')) return
                        try {
                          const response = await fetch('/api/admin/revoke-access', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uid: userId }),
                          })
                          if (response.ok) {
                            setUserIsAdmin(false)
                            alert('Analytics access revoked. User will be logged out on next request.')
                          } else {
                            const error = await response.json()
                            alert(`Failed to revoke access: ${error.error}`)
                          }
                        } catch (error) {
                          console.error('Error revoking access:', error)
                          alert('Failed to revoke access')
                        }
                      }}
                    >
                      Revoke Access
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button
                      variant="default"
                      className="bg-gray-900 hover:bg-gray-800 text-white"
                      onClick={async () => {
                        if (!confirm('Grant analytics access to this user? They will need to set up MFA on first login.')) return
                        setIsGrantingAccess(true)
                        try {
                          const response = await fetch('/api/admin/set-role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uid: userId, role: 'admin' }),
                          })
                          if (response.ok) {
                            setUserIsAdmin(true)
                            alert('✓ Analytics access granted! User can now log in to the analytics dashboard.')
                          } else {
                            const error = await response.json()
                            alert(`Failed to grant access: ${error.error}`)
                          }
                        } catch (error) {
                          console.error('Error granting access:', error)
                          alert('Failed to grant access')
                        } finally {
                          setIsGrantingAccess(false)
                        }
                      }}
                      disabled={isGrantingAccess}
                    >
                      {isGrantingAccess ? 'Granting Access...' : '🌑 Turn to the Dark Side'}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Grant this user access to the analytics dashboard. They will need to set up MFA on first login.
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600">Created At</label>
              <div className="mt-1 text-lg">{formatDate(displayUser.created_at)}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Last Login</label>
              <div className="mt-1 text-lg">
                {displayUser.last_login_at ? formatDate(displayUser.last_login_at) : "Never"}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Updated At</label>
              <div className="mt-1 text-lg">
                {displayUser.updatedAt ? formatDate(displayUser.updatedAt) : '-'}
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

      {/* Wallet Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Current Balance */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(user?.tokenBalance || 0)} tokens
                </p>
              </div>
            </div>

            {/* Adjust Balance Form */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Adjust Balance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  type="number"
                  placeholder="Amount (positive to add, negative to deduct)"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Note (e.g., 'Manual adjustment')"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    const amount = parseInt(adjustAmount)
                    if (!amount || amount === 0) {
                      alert("Please enter a non-zero amount")
                      return
                    }
                    setIsAdjusting(true)
                    try {
                      const response = await fetch(`/api/admin/wallet/${userId}/adjust`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          amount,
                          note: adjustNote || "Manual adjustment by admin",
                        }),
                      })
                      if (response.ok) {
                        // Reload user and transactions
                        const updatedUser = await getUserDetail(userId)
                        setUser(updatedUser)
                        setEditingUser(updatedUser ? { ...updatedUser } : null)
                        setAdjustAmount("")
                        setAdjustNote("")
                        // Reload transactions
                        const txResponse = await fetch(`/api/admin/wallet/${userId}/transactions?pageSize=5`)
                        if (txResponse.ok) {
                          const txData = await txResponse.json()
                          setWalletTransactions(txData.items || [])
                        }
                      } else {
                        const error = await response.json()
                        alert(error.error || "Failed to adjust balance")
                      }
                    } catch (error) {
                      console.error("Error adjusting balance:", error)
                      alert("Error adjusting balance")
                    } finally {
                      setIsAdjusting(false)
                    }
                  }}
                  disabled={isAdjusting || !adjustAmount}
                >
                  {isAdjusting ? "Adjusting..." : "Adjust Balance"}
                </Button>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Transactions</h3>
              {walletLoading ? (
                <div className="text-sm text-gray-500 py-4">Loading transactions...</div>
              ) : walletTransactions.length === 0 ? (
                <div className="text-sm text-gray-500 py-4">No transactions found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge
                            variant={
                              tx.type === "credit"
                                ? "default"
                                : tx.type === "debit"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={tx.amount > 0 ? "text-green-600" : "text-red-600"}>
                          {tx.amount > 0 ? "+" : ""}
                          {formatNumber(tx.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{tx.source}</TableCell>
                        <TableCell className="font-medium">{formatNumber(tx.balanceAfter)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card className="mb-6">
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
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      {featureFlags.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {featureFlags.map((flag) => (
                <div key={flag.id} className="flex items-center justify-between rounded-md p-2 hover:bg-gray-50">
                  <span className="font-medium">Flag #{flag.flag_id}</span>
                  <Badge variant={flag.is_enabled ? "default" : "secondary"}>
                    {flag.is_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
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
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell>
                    {log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ""}
                  </TableCell>
                  <TableCell>{formatDate(log.created_at)}</TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
