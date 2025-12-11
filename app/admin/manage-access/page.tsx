"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface User {
  uid: string
  email: string | null
  isAdmin: boolean
  role: string | null
  mfaEnabled: boolean
  lastLogin: string | null
  createdAt: string
}

export default function ManageAccessPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/users', {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err: any) {
      console.error('[Manage Access] Error:', err)
      setError(err.message || 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetAdmin = async (uid: string, role: string) => {
    try {
      const response = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid, role }),
      })

      if (!response.ok) {
        throw new Error('Failed to set admin role')
      }

      // Reload users
      await loadUsers()
    } catch (err: any) {
      console.error('[Manage Access] Error setting role:', err)
      setError(err.message || 'Failed to set admin role')
    }
  }

  const handleRevokeAccess = async (uid: string) => {
    if (!confirm('Are you sure you want to revoke admin access for this user? They will be logged out immediately.')) {
      return
    }

    try {
      const response = await fetch('/api/admin/revoke-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
      })

      if (!response.ok) {
        throw new Error('Failed to revoke access')
      }

      // Reload users
      await loadUsers()
    } catch (err: any) {
      console.error('[Manage Access] Error revoking access:', err)
      setError(err.message || 'Failed to revoke access')
    }
  }

  const filteredUsers = users.filter(user => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.uid.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manage Admin Access</h1>
        <p className="mt-2 text-gray-600">
          Assign or revoke admin privileges for users
        </p>
      </div>

      {error && (
        <ErrorState
          title="Error"
          description={error}
          onRetry={loadUsers}
          variant="banner"
          className="mb-6"
        />
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or UID..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState variant="table" />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title="No users found"
          description={search ? "No users match your search." : "No users found in the system."}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-gray-700">Email</th>
                    <th className="text-left p-3 font-medium text-gray-700">UID</th>
                    <th className="text-left p-3 font-medium text-gray-700">Role</th>
                    <th className="text-left p-3 font-medium text-gray-700">MFA</th>
                    <th className="text-left p-3 font-medium text-gray-700">Last Login</th>
                    <th className="text-left p-3 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="border-b hover:bg-gray-50">
                      <td className="p-3">{user.email || 'N/A'}</td>
                      <td className="p-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {user.uid.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="p-3">
                        {user.isAdmin ? (
                          <Badge variant="default">{user.role || 'admin'}</Badge>
                        ) : (
                          <Badge variant="outline">No access</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {user.mfaEnabled ? (
                          <Badge variant="default" className="bg-green-600">Enabled</Badge>
                        ) : (
                          <Badge variant="outline">Not set</Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {!user.isAdmin ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetAdmin(user.uid, 'admin')}
                              >
                                Make Admin
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetAdmin(user.uid, 'superAdmin')}
                              >
                                Make SuperAdmin
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevokeAccess(user.uid)}
                            >
                              Revoke Access
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

