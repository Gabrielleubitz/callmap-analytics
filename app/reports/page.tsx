"use client"

/**
 * Reports Page
 * 
 * Create and manage automated reports
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download } from "lucide-react"

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateReport = async (type: string) => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
          format: 'json',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // In production, this would download a PDF/Excel file
        alert('Report generated! (PDF/Excel export coming soon)')
      }
    } catch (error) {
      console.error('[Reports] Error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600 text-sm">
          Generate and export analytics reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Daily Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Daily overview of key metrics and activities
            </p>
            <Button
              onClick={() => handleGenerateReport('daily')}
              disabled={isGenerating}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Weekly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Weekly analytics summary with trends
            </p>
            <Button
              onClick={() => handleGenerateReport('weekly')}
              disabled={isGenerating}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Monthly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Comprehensive monthly analytics report
            </p>
            <Button
              onClick={() => handleGenerateReport('monthly')}
              disabled={isGenerating}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

