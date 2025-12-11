import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
  variant?: 'banner' | 'card'
}

/**
 * ErrorState component
 * 
 * Displays error messages in a consistent, user-friendly way.
 * - banner: Compact banner for inline errors
 * - card: Full card for prominent error display
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
  variant = 'banner',
}: ErrorStateProps) {
  if (variant === 'banner') {
    return (
      <div className={cn("rounded-md bg-red-50 border border-red-200 p-4", className)}>
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-red-800">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-red-700">{description}</p>
            )}
            {onRetry && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // card variant
  return (
    <div className={cn("rounded-lg border border-red-200 bg-red-50 p-6", className)}>
      <div className="flex items-start">
        <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 mr-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-red-900">{title}</h3>
          {description && (
            <p className="mt-2 text-sm text-red-700">{description}</p>
          )}
          {onRetry && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={onRetry}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

