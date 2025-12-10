"use client"

import { useState } from "react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateRange } from "@/lib/db"

type PresetRange = "today" | "7d" | "30d" | "90d" | "custom"

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [preset, setPreset] = useState<PresetRange>("30d")

  const applyPreset = (p: PresetRange) => {
    setPreset(p)
    if (p === "custom") return

    const now = new Date()
    let start: Date
    let end: Date = endOfDay(now)

    switch (p) {
      case "today":
        start = startOfDay(now)
        break
      case "7d":
        start = startOfDay(subDays(now, 7))
        break
      case "30d":
        start = startOfDay(subDays(now, 30))
        break
      case "90d":
        start = startOfDay(subDays(now, 90))
        break
      default:
        return
    }

    onChange({ start, end })
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {(["today", "7d", "30d", "90d"] as const).map((p) => (
          <Button
            key={p}
            variant={preset === p ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(p)}
          >
            {p === "today" ? "Today" : p === "7d" ? "7d" : p === "30d" ? "30d" : "90d"}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={format(value.start, "yyyy-MM-dd")}
          onChange={(e) => {
            setPreset("custom")
            onChange({
              start: startOfDay(new Date(e.target.value)),
              end: value.end,
            })
          }}
          className="w-40"
        />
        <span className="text-sm text-gray-500">to</span>
        <Input
          type="date"
          value={format(value.end, "yyyy-MM-dd")}
          onChange={(e) => {
            setPreset("custom")
            onChange({
              start: value.start,
              end: endOfDay(new Date(e.target.value)),
            })
          }}
          className="w-40"
        />
      </div>
    </div>
  )
}

