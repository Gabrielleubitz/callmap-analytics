/**
 * Team List Card
 * 
 * Card-based display for team information in the Teams page.
 * Supports collapsible details panel.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Users, Calendar, Globe } from "lucide-react"
import { useState } from "react"
import { TeamDetailsPanel } from "./team-details-panel"
import { formatDateTime } from "@/lib/utils"
import { formatNumber } from "@/lib/utils"
import Link from "next/link"

interface TeamListCardProps {
  team: {
    id: string
    name: string
    owner_email?: string
    created_at?: any
    plan?: string
    status?: string
    tokens_used_this_month?: number
    sessions_this_month?: number
    country?: string
    members?: any[]
    last_active?: any
  }
}

export function TeamListCard({ team }: TeamListCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700",
    starter: "bg-blue-100 text-blue-700",
    pro: "bg-purple-100 text-purple-700",
    enterprise: "bg-green-100 text-green-700",
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-700",
    suspended: "bg-red-100 text-red-700",
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Left: Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Link
                href={`/teams/${team.id}`}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {team.name || "Unnamed Team"}
              </Link>
              {team.plan && (
                <Badge className={planColors[team.plan] || planColors.free}>
                  {team.plan}
                </Badge>
              )}
              {team.status && (
                <Badge className={statusColors[team.status] || statusColors.inactive}>
                  {team.status}
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              {team.owner_email && (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Owner:</span>
                  <span>{team.owner_email}</span>
                </div>
              )}
              {team.created_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created {formatDateTime(team.created_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Metrics */}
          <div className="flex items-center gap-6 ml-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-0.5">Tokens (month)</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatNumber(team.tokens_used_this_month || 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-0.5">Sessions (month)</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatNumber(team.sessions_this_month || 0)}
              </div>
            </div>
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
          <div className="mt-4 pt-4 border-t border-gray-200">
            <TeamDetailsPanel team={team} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

