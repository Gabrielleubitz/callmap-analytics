"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface ErrorNotification {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  app_area: string
  user_id: string | null
  workspace_id: string | null
  expected: boolean
  critical: boolean
}

export function ErrorNotificationBell() {
  const [count, setCount] = useState(0)
  const [recentErrors, setRecentErrors] = useState<ErrorNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    async function fetchErrorCount() {
      try {
        const response = await fetch('/api/support/errors/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page: 1,
            pageSize: 5,
            unresolved_only: true,
            expected: false, // Only unexpected errors
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const errors = data.items || data.data || []
          const unexpectedCritical = errors.filter(
            (e: ErrorNotification) => !e.expected || e.critical
          )
          setCount(unexpectedCritical.length)
          setRecentErrors(unexpectedCritical.slice(0, 5))
        }
      } catch (error) {
        console.error('[ErrorNotificationBell] Error:', error)
      }
    }

    fetchErrorCount()
    const interval = setInterval(fetchErrorCount, 30000) // Refresh every 30s

    return () => clearInterval(interval)
  }, [])

  if (count === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Error notifications"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {count > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {count > 9 ? '9+' : count}
          </Badge>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="p-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Recent Errors
                </h3>
                <Link
                  href="/support/errors"
                  className="text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => setIsOpen(false)}
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {recentErrors.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  No recent errors
                </div>
              ) : (
                recentErrors.map((error) => (
                  <Link
                    key={error.id}
                    href={`/support/errors/${error.id}`}
                    className="block p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={
                          error.severity === 'critical'
                            ? 'destructive'
                            : error.severity === 'warning'
                            ? 'default'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {error.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {error.app_area}
                        </div>
                        <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                          {error.message.substring(0, 100)}
                          {error.message.length > 100 ? '...' : ''}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

