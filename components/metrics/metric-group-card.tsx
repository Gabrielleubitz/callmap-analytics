/**
 * Metric Group Card
 * 
 * Container for grouped metrics within a section.
 * Displays multiple related metrics in a clean grid.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface MetricItem {
  label: string
  value: string | number
  sparkline?: Array<{ date: string; value: number }>
}

interface MetricGroupCardProps {
  title: string
  description?: string
  metrics: MetricItem[]
  columns?: 2 | 3
  className?: string
}

export function MetricGroupCard({
  title,
  description,
  metrics,
  columns = 3,
  className = "",
}: MetricGroupCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === "number") {
      return val.toLocaleString()
    }
    return val
  }

  const gridCols = columns === 2 ? "grid-cols-2" : "grid-cols-3"

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className={`grid ${gridCols} gap-4`}>
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-2">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {metric.label}
              </div>
              <div className="text-xl font-bold text-gray-900">
                {formatValue(metric.value)}
              </div>
              {metric.sparkline && metric.sparkline.length > 0 && (
                <div className="h-[40px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metric.sparkline}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

