"use client"

/**
 * Benchmarking Dashboard
 * 
 * Compare metrics to industry standards and internal benchmarks
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Target } from "lucide-react"

// Industry benchmark data (simplified - would come from external source)
const INDUSTRY_BENCHMARKS = {
  churnRate: { value: 5, unit: '%', source: 'SaaS Industry Average' },
  mrrGrowth: { value: 15, unit: '%', source: 'SaaS Industry Average' },
  customerLifetimeValue: { value: 3000, unit: '$', source: 'SaaS Industry Average' },
  netPromoterScore: { value: 50, unit: '', source: 'SaaS Industry Average' },
}

export default function BenchmarksPage() {
  // Simplified - would fetch actual metrics
  const currentMetrics = {
    churnRate: 3.5,
    mrrGrowth: 18,
    customerLifetimeValue: 3500,
    netPromoterScore: 55,
  }

  const compareToBenchmark = (current: number, benchmark: number) => {
    const diff = current - benchmark
    const percentDiff = (diff / benchmark) * 100
    return {
      diff,
      percentDiff,
      isBetter: diff > 0 ? (benchmark < 0 ? false : true) : false, // Simplified logic
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Benchmarking</h1>
        <p className="text-gray-600 text-sm">
          Compare your metrics to industry standards and best-in-class targets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(INDUSTRY_BENCHMARKS).map(([key, benchmark]) => {
          const current = currentMetrics[key as keyof typeof currentMetrics]
          const comparison = compareToBenchmark(current, benchmark.value)

          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">
                        {current}{benchmark.unit}
                      </div>
                      <div className="text-xs text-gray-500">Your Metric</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-700">
                        {benchmark.value}{benchmark.unit}
                      </div>
                      <div className="text-xs text-gray-500">Industry Avg</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {comparison.isBetter ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm ${comparison.isBetter ? 'text-green-600' : 'text-red-600'}`}>
                      {comparison.percentDiff > 0 ? '+' : ''}{comparison.percentDiff.toFixed(1)}% vs benchmark
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Source: {benchmark.source}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Your metrics are compared against industry benchmarks. Green indicates performance above
            industry average, red indicates areas for improvement.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

