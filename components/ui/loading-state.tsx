import { cn } from "@/lib/utils"

interface LoadingStateProps {
  variant?: 'card' | 'table' | 'page'
  message?: string
  className?: string
}

/**
 * LoadingState component
 * 
 * Provides consistent loading skeletons for different contexts:
 * - card: For KPI cards and metric displays
 * - table: For data tables
 * - page: For full page loads
 */
export function LoadingState({ variant = 'card', message, className }: LoadingStateProps) {
  if (variant === 'card') {
    return (
      <div className={cn("rounded-lg border bg-white p-6", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-8 w-32 bg-gray-200 rounded"></div>
          <div className="h-4 w-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn("rounded-lg border bg-white overflow-hidden", className)}>
        <div className="animate-pulse">
          {/* Table header */}
          <div className="border-b bg-gray-50 p-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b p-4">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // page variant
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[400px] space-y-4", className)}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      {message && <p className="text-gray-600">{message}</p>}
    </div>
  )
}

