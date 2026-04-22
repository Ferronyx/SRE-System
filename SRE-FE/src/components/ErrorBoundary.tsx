import { ErrorBoundary as SentryErrorBoundary } from '@sentry/react'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

function FallbackUI({ resetError }: { resetError: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm p-6">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle size={20} className="text-destructive" />
        </div>
        <div>
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-1">
            An unexpected error occurred. Try refreshing the page.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetError}>
          Try again
        </Button>
      </div>
    </div>
  )
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <SentryErrorBoundary fallback={({ resetError }) => <FallbackUI resetError={resetError} />}>
      {children}
    </SentryErrorBoundary>
  )
}
