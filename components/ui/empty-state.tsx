import { Inbox } from "lucide-react"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  cta?: ReactNode
  className?: string
  icon?: ReactNode
}

/**
 * EmptyState component
 * 
 * Displays a friendly empty state when no data is available.
 * Used for "no results" situations with clear, actionable messaging.
 */
export function EmptyState({
  title,
  description,
  cta,
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div className={cn("rounded-lg border bg-gray-50 p-12 text-center", className)}>
      <div className="flex flex-col items-center">
        {icon || <Inbox className="h-12 w-12 text-gray-400 mb-4" />}
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 max-w-md">{description}</p>
        )}
        {cta && <div className="mt-6">{cta}</div>}
      </div>
    </div>
  )
}

