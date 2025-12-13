/**
 * Hero Metric Card
 * 
 * Large, prominent metric card for primary KPIs.
 * Supports sparklines for trend visualization.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface HeroMetricCardProps {
  title: string
  value: string | number
  description?: string
  delta?: {
    value: number
    label?: string
  }
  sparkline?: Array<{ date: string; value: number }>
  icon?: React.ReactNode
  className?: string
}

export function HeroMetricCard({
  title,
  value,
  description,
  delta,
  sparkline,
  icon,
  className = "",
}: HeroMetricCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === "number") {
      return val.toLocaleString()
    }
    return val
  }

  const deltaColor = delta && delta.value >= 0 ? "text-green-600" : "text-red-600"
  const DeltaIcon = delta && delta.value >= 0 ? TrendingUp : TrendingDown

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          {icon && <div className="text-gray-400">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-gray-900">{formatValue(value)}</div>
          {description && (
            <div className="text-xs text-gray-500">{description}</div>
          )}
          
          {delta && (
            <div className={`flex items-center gap-1 text-sm ${deltaColor}`}>
              <DeltaIcon className="h-4 w-4" />
              <span>
                {Math.abs(delta.value).toFixed(1)}% {delta.label || "vs yesterday"}
              </span>
            </div>
          )}

          {sparkline && sparkline.length > 0 && (
            <div className="h-[60px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={delta && delta.value >= 0 ? "#10b981" : "#ef4444"}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

