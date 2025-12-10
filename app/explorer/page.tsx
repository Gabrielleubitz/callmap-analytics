"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { getTableRows, TABLE_NAMES, TableName } from "@/lib/db"
import { formatDate } from "@/lib/utils"

export default function DataExplorerPage() {
  const [selectedTable, setSelectedTable] = useState<TableName>("teams")
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState("")
  const [selectedRow, setSelectedRow] = useState<any>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getTableRows(selectedTable, {
        page,
        pageSize,
        search,
      })
      setData(result.data)
      setColumns(result.columns)
      setTotal(result.total)
      setLoading(false)
    }
    load()
  }, [selectedTable, page, search])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Data Explorer</h1>
        <p className="mt-2 text-gray-600">
          Browse all database tables and view raw data
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Tables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {TABLE_NAMES.map((table) => (
                  <button
                    key={table}
                    onClick={() => {
                      setSelectedTable(table)
                      setPage(1)
                      setSearch("")
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedTable === table
                        ? "bg-gray-100 font-medium text-gray-900"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {table}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedTable}</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : data.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No data found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.map((row, idx) => (
                          <TableRow
                            key={row.id || idx}
                            className="cursor-pointer"
                            onClick={() => setSelectedRow(row)}
                          >
                            {columns.map((col) => {
                              const value = row[col]
                              if (value === null || value === undefined) {
                                return <TableCell key={col}>-</TableCell>
                              }
                              if (value instanceof Date || (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/))) {
                                return (
                                  <TableCell key={col} className="text-xs">
                                    {formatDate(value)}
                                  </TableCell>
                                )
                              }
                              if (typeof value === "object") {
                                return (
                                  <TableCell key={col} className="font-mono text-xs">
                                    {JSON.stringify(value).slice(0, 50)}...
                                  </TableCell>
                                )
                              }
                              return (
                                <TableCell key={col} className="text-xs">
                                  {String(value).slice(0, 100)}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{" "}
                      {total}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= total}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row Detail Drawer */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Row Details</CardTitle>
                <Button variant="ghost" onClick={() => setSelectedRow(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-md bg-gray-100 p-4 text-xs">
                {JSON.stringify(selectedRow, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

