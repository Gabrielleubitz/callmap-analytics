/**
 * Team Details Panel
 * 
 * Collapsible panel showing detailed team information.
 */

import { Users, Calendar, Globe, CreditCard, Activity } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { formatNumber } from "@/lib/utils"

interface TeamDetailsPanelProps {
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

export function TeamDetailsPanel({ team }: TeamDetailsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Members */}
      {team.members && team.members.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-700">Members</h4>
          </div>
          <div className="space-y-1">
            {team.members.map((member: any, index: number) => (
              <div key={index} className="text-sm text-gray-600">
                {member.email || member.name || "Unknown"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing Plan */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-700">Billing Plan</h4>
        </div>
        <div className="text-sm text-gray-600">
          {team.plan || "free"} plan
        </div>
      </div>

      {/* Last Active */}
      {team.last_active && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-700">Last Active</h4>
          </div>
          <div className="text-sm text-gray-600">
            {formatDateTime(team.last_active)}
          </div>
        </div>
      )}

      {/* Country */}
      {team.country && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-700">Country</h4>
          </div>
          <div className="text-sm text-gray-600">{team.country}</div>
        </div>
      )}
    </div>
  )
}

