"use client"

/**
 * Custom Dashboards Page
 * 
 * List and manage custom dashboards
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"
import { Plus, LayoutDashboard, Trash2 } from "lucide-react"

interface Dashboard {
  id: string
  name: string
  description?: string
  widgets: any[]
  layout?: any
  created_at: string
  updated_at: string
  created_by: string
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboards()
  }, [])

  const fetchDashboards = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboards')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboards')
      }
      const data = await response.json()
      setDashboards(data.items || [])
    } catch (err: any) {
      console.error('[Dashboards] Error:', err)
      setError(err.message || 'Failed to load dashboards')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) {
      return
    }

    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await fetchDashboards()
      }
    } catch (err) {
      console.error('[Dashboards] Error deleting:', err)
    }
  }

  if (isLoading && dashboards.length === 0) {
    return <LoadingState />
  }

  if (error && dashboards.length === 0) {
    return <ErrorState description={error} onRetry={fetchDashboards} />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Dashboards</h1>
          <p className="text-gray-600 text-sm">
            Create and manage custom analytics dashboards
          </p>
        </div>
            <Link href="/dashboards/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Dashboard
              </Button>
            </Link>
      </div>

      {dashboards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No custom dashboards yet</p>
            <Link href="/dashboards/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <Link
                    href={`/dashboards/${dashboard.id}`}
                    className="hover:underline"
                  >
                    {dashboard.name}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(dashboard.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.description && (
                  <p className="text-sm text-gray-600 mb-3">{dashboard.description}</p>
                )}
                <div className="text-xs text-gray-500 mb-3">
                  {dashboard.widgets?.length || 0} widgets
                </div>
                <div className="text-xs text-gray-400">
                  Updated: {formatDateTime(new Date(dashboard.updated_at))}
                </div>
                <div className="mt-3">
                  <Link href={`/dashboards/${dashboard.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

