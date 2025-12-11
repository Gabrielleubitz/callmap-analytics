/**
 * Filter Chips
 * 
 * Displays active filters as removable chips.
 */

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface FilterChip {
  key: string
  label: string
  value: string
}

interface FilterChipsProps {
  filters: FilterChip[]
  onRemove: (key: string) => void
  onClearAll?: () => void
  className?: string
}

export function FilterChips({
  filters,
  onRemove,
  onClearAll,
  className = "",
}: FilterChipsProps) {
  if (filters.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {filters.map((filter) => (
        <div
          key={filter.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 border border-blue-200"
        >
          <span className="font-medium">{filter.label}:</span>
          <span>{filter.value}</span>
          <button
            onClick={() => onRemove(filter.key)}
            className="ml-1 rounded-full hover:bg-blue-100 p-0.5 transition-colors"
            aria-label={`Remove ${filter.label} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {onClearAll && filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  )
}

