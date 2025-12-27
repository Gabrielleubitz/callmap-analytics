"use client"

/**
 * Revenue Optimization Page
 * 
 * Identifies upsell opportunities, win-back campaigns, and expansion revenue
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { formatNumber } from "@/lib/utils"
import Link from "next/link"
import { TrendingUp, DollarSign, Target, ArrowUpRight } from "lucide-react"

interface RevenueOpportunity {
  userId: string
  type: 'upsell' | 'win_back' | 'expansion'
  currentPlan: string
  recommendedPlan: string
  opportunityValue: number
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

export default function RevenueOptimizationPage() {
  const [opportunities, setOpportunities] = useState<RevenueOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'upsell' | 'win_back' | 'expansion'>('all')

  useEffect(() => {
    const fetchOpportunities = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/analytics/revenue-opportunities')
        if (!response.ok) {
          throw new Error('Failed to fetch opportunities')
        }
        const data = await response.json()
        setOpportunities(data.items || [])
      } catch (err: any) {
        console.error('[Revenue Optimization] Error:', err)
        setError(err.message || 'Failed to load opportunities')
      } finally {
        setIsLoading(false)
      }
    }

    fetchOpportunities()
  }, [])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'upsell':
        return <Badge className="bg-blue-100 text-blue-700">Upsell</Badge>
      case 'win_back':
        return <Badge className="bg-green-100 text-green-700">Win-Back</Badge>
      case 'expansion':
        return <Badge className="bg-purple-100 text-purple-700">Expansion</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-100 text-green-700">High</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
      case 'low':
        return <Badge className="bg-gray-100 text-gray-700">Low</Badge>
      default:
        return <Badge variant="outline">{confidence}</Badge>
    }
  }

  if (isLoading && opportunities.length === 0) {
    return <LoadingState />
  }

  if (error && opportunities.length === 0) {
    return <ErrorState description={error} />
  }

  const filteredOpportunities = filter === 'all'
    ? opportunities
    : opportunities.filter(o => o.type === filter)

  const totalOpportunityValue = filteredOpportunities.reduce((sum, o) => sum + o.opportunityValue, 0)
  const upsellCount = opportunities.filter(o => o.type === 'upsell').length
  const winBackCount = opportunities.filter(o => o.type === 'win_back').length

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue Optimization</h1>
          <p className="text-gray-600 text-sm">
            Identify upsell opportunities, win-back campaigns, and expansion revenue
          </p>
        </div>
        <div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Opportunities</option>
            <option value="upsell">Upsell</option>
            <option value="win_back">Win-Back</option>
            <option value="expansion">Expansion</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Opportunity Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-3xl font-bold">${formatNumber(totalOpportunityValue)}</span>
              <span className="text-sm text-gray-500">/month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Upsell Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-3xl font-bold">{upsellCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Win-Back Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <span className="text-3xl font-bold">{winBackCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No opportunities found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-gray-700">User ID</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Type</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Current Plan</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Recommended</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Opportunity Value</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Confidence</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Reason</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opportunity) => (
                    <tr key={opportunity.userId} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <Link
                          href={`/users/${opportunity.userId}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {opportunity.userId.slice(0, 12)}...
                        </Link>
                      </td>
                      <td className="p-3">{getTypeBadge(opportunity.type)}</td>
                      <td className="p-3">
                        <Badge variant="outline">{opportunity.currentPlan}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className="bg-green-100 text-green-700">
                          {opportunity.recommendedPlan}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          <span className="font-semibold">${opportunity.opportunityValue}/mo</span>
                        </div>
                      </td>
                      <td className="p-3">{getConfidenceBadge(opportunity.confidence)}</td>
                      <td className="p-3 text-sm text-gray-600 max-w-xs truncate">
                        {opportunity.reason}
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/users/${opportunity.userId}`}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

