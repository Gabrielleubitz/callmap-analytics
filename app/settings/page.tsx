"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"

export default function SettingsPage() {
  const environment = process.env.NODE_ENV || "development"

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Configure admin dashboard settings</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Current deployment environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={environment === "production" ? "default" : "secondary"}>
                {environment}
              </Badge>
              <span className="text-sm text-gray-600">
                {environment === "production" ? "Production" : "Development"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Date Range</CardTitle>
            <CardDescription>Default date range for overview and metrics pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Default Range</label>
                <Select defaultValue="30d" className="mt-1">
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overview KPIs</CardTitle>
            <CardDescription>Select which KPIs appear on the Overview page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                "Total Users",
                "Active Users",
                "New Registrations",
                "Active Teams",
                "Sessions",
                "Tokens Used",
                "Estimated Cost",
                "MRR Estimate",
              ].map((kpi) => (
                <label key={kpi} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">{kpi}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Costs</CardTitle>
            <CardDescription>Reference costs for calculating estimated costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">GPT-4o (per 1M tokens)</label>
                <Input type="number" defaultValue="5.00" step="0.01" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  GPT-4o-mini (per 1M tokens)
                </label>
                <Input type="number" defaultValue="0.15" step="0.01" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">GPT-4 (per 1M tokens)</label>
                <Input type="number" defaultValue="30.00" step="0.01" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">GPT-3.5 (per 1M tokens)</label>
                <Input type="number" defaultValue="2.00" step="0.01" className="mt-1" />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Note: These are reference values. Actual costs are calculated from the database.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

