/**
 * User List Card
 * 
 * Card-based display for user information in the Users page.
 * Supports collapsible details panel.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Mail, Calendar, Users, Activity, Copy, Check } from "lucide-react"
import { useState } from "react"
import { formatDateTime, formatDate, getInitials } from "@/lib/utils"
import Link from "next/link"

interface UserListCardProps {
  user: {
    id: string
    name?: string | null
    email: string
    team_id?: string | null
    role?: string
    status?: string
    created_at?: any
    last_login_at?: any
    last_activity_at?: any
    tokenBalance?: number
    audioMinutesUsed?: number
    mapsGenerated?: number
  }
}

export function UserListCard({ user }: UserListCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyUID = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy UID:', error)
    }
  }

  const roleColors: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700",
    admin: "bg-blue-100 text-blue-700",
    member: "bg-gray-100 text-gray-700",
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    invited: "bg-yellow-100 text-yellow-700",
    disabled: "bg-red-100 text-red-700",
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Left: Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
                {getInitials(user.name || user.email)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/users/${user.id}`}
                    className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors block truncate"
                  >
                    {user.name || "Unnamed User"}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleCopyUID}
                    title="Copy UID to clipboard"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </Button>
                </div>
                <div className="text-sm text-gray-500 truncate">{user.email}</div>
              </div>
              {user.role && (
                <Badge className={roleColors[user.role] || roleColors.member}>
                  {user.role}
                </Badge>
              )}
              {user.status && (
                <Badge className={statusColors[user.status] || statusColors.invited}>
                  {user.status}
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              {user.team_id && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <Link
                    href={`/teams/${user.team_id}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    Team: {user.team_id.slice(0, 8)}...
                  </Link>
                </div>
              )}
              {user.created_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created {formatDateTime(user.created_at)}</span>
                </div>
              )}
              {user.last_login_at ? (
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Last login {formatDate(user.last_login_at)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Never logged in</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Metrics */}
          <div className="flex items-center gap-6 ml-4">
            {user.tokenBalance !== undefined && (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Token Balance</div>
                <div className="text-sm font-semibold text-gray-900">
                  {user.tokenBalance.toLocaleString()}
                </div>
              </div>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Details Panel */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {user.last_activity_at && (
                <div>
                  <span className="text-gray-500">Last Activity:</span>{" "}
                  <span className="font-medium">{formatDateTime(user.last_activity_at)}</span>
                </div>
              )}
              {user.audioMinutesUsed !== undefined && (
                <div>
                  <span className="text-gray-500">Audio Minutes:</span>{" "}
                  <span className="font-medium">{user.audioMinutesUsed.toLocaleString()}</span>
                </div>
              )}
              {user.mapsGenerated !== undefined && (
                <div>
                  <span className="text-gray-500">Maps Generated:</span>{" "}
                  <span className="font-medium">{user.mapsGenerated.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

